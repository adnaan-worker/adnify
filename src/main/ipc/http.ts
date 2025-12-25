/**
 * HTTP 服务 IPC handlers
 * 提供网络请求能力给渲染进程
 */

import { logger } from '@shared/utils/Logger'
import { ipcMain } from 'electron'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

// ===== 读取 URL 内容 =====

interface ReadUrlResult {
    success: boolean
    content?: string
    title?: string
    error?: string
    contentType?: string
    statusCode?: number
}

async function fetchUrl(url: string, timeout = 30000): Promise<ReadUrlResult> {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url)
            const protocol = parsedUrl.protocol === 'https:' ? https : http

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Adnify/1.0 (AI Code Editor)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
                },
                timeout,
            }

            const req = protocol.request(options, (res) => {
                let data = ''
                const contentType = res.headers['content-type'] || ''

                // 检查是否是文本内容
                if (!contentType.includes('text') &&
                    !contentType.includes('json') &&
                    !contentType.includes('xml') &&
                    !contentType.includes('javascript')) {
                    resolve({
                        success: false,
                        error: `Unsupported content type: ${contentType}`,
                        statusCode: res.statusCode,
                        contentType,
                    })
                    req.destroy()
                    return
                }

                res.setEncoding('utf8')
                res.on('data', (chunk) => {
                    data += chunk
                    // 限制响应大小
                    if (data.length > 500000) {
                        req.destroy()
                        resolve({
                            success: true,
                            content: data.slice(0, 500000) + '\n\n...(truncated, content too large)',
                            statusCode: res.statusCode,
                            contentType,
                        })
                    }
                })

                res.on('end', () => {
                    // 提取 HTML 标题
                    let title = ''
                    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i)
                    if (titleMatch) {
                        title = titleMatch[1].trim()
                    }

                    // 简单的 HTML 到文本转换
                    let content = data
                    if (contentType.includes('html')) {
                        content = htmlToText(data)
                    }

                    resolve({
                        success: true,
                        content,
                        title,
                        statusCode: res.statusCode,
                        contentType,
                    })
                })
            })

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Request failed: ${error.message}`,
                })
            })

            req.on('timeout', () => {
                req.destroy()
                resolve({
                    success: false,
                    error: 'Request timed out',
                })
            })

            req.end()
        } catch (error) {
            resolve({
                success: false,
                error: `Invalid URL: ${error}`,
            })
        }
    })
}

// 简单的 HTML 到文本转换
function htmlToText(html: string): string {
    return html
        // 移除 script 和 style
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // 移除 HTML 注释
        .replace(/<!--[\s\S]*?-->/g, '')
        // 转换常用标签
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        // 保留链接文本
        .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
        // 移除所有其他标签
        .replace(/<[^>]+>/g, '')
        // 解码 HTML 实体
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // 清理多余空白
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim()
}

// ===== 网络搜索 =====
// 注意：真正的网络搜索需要 API key (如 SerpAPI, Google Custom Search, Bing Search)
// 这里提供一个框架，实际实现需要用户配置 API

interface SearchResult {
    title: string
    url: string
    snippet: string
}

interface WebSearchResult {
    success: boolean
    results?: SearchResult[]
    error?: string
}

// 搜索 API key 缓存 (可选增强)
let cachedSearchApiKey: string | null = null
let cachedSearchApiType: 'serper' | 'tavily' | null = null

// 设置搜索 API key (从设置界面调用)
export function setSearchApiKey(type: 'serper' | 'tavily', key: string) {
    cachedSearchApiType = type
    cachedSearchApiKey = key
    logger.ipc.info(`[HTTP] Search API configured: ${type}`)
}

async function webSearch(query: string, maxResults = 5): Promise<WebSearchResult> {
    // 优先使用配置的 API (如果有)
    const apiKey = cachedSearchApiKey || process.env.SERPER_API_KEY || process.env.TAVILY_API_KEY || ''
    const apiType = cachedSearchApiType ||
        (process.env.SERPER_API_KEY ? 'serper' : process.env.TAVILY_API_KEY ? 'tavily' : null)

    if (apiKey && apiType) {
        try {
            if (apiType === 'serper') {
                return await searchWithSerper(query, apiKey, maxResults)
            } else if (apiType === 'tavily') {
                return await searchWithTavily(query, apiKey, maxResults)
            }
        } catch (error) {
            logger.ipc.error(`[HTTP] ${apiType} search failed, falling back to local:`, error)
        }
    }

    // 本地抓取方案 - 使用 Electron BrowserWindow
    try {
        return await searchWithLocalBrowser(query, maxResults)
    } catch (error) {
        logger.ipc.error('[HTTP] Local browser search failed:', error)
        return {
            success: false,
            error: `搜索失败: ${error}`,
        }
    }
}

// 本地浏览器抓取 (使用 Electron BrowserWindow)
async function searchWithLocalBrowser(query: string, maxResults: number): Promise<WebSearchResult> {
    const { BrowserWindow } = require('electron')

    // 创建隐藏的浏览器窗口
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    try {
        // 使用 Bing 搜索 (比 Google 更容易抓取)
        const encodedQuery = encodeURIComponent(query)
        const searchUrl = `https://www.bing.com/search?q=${encodedQuery}&count=${maxResults * 2}`

        await win.loadURL(searchUrl)

        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 2000))

        // 执行 JavaScript 提取搜索结果
        const results = await win.webContents.executeJavaScript(`
            (function() {
                const results = [];
                // Bing 搜索结果选择器
                const items = document.querySelectorAll('#b_results .b_algo');
                
                items.forEach(item => {
                    const titleEl = item.querySelector('h2 a');
                    const snippetEl = item.querySelector('.b_caption p');
                    
                    if (titleEl) {
                        results.push({
                            title: titleEl.textContent || '',
                            url: titleEl.href || '',
                            snippet: snippetEl ? snippetEl.textContent : '',
                        });
                    }
                });
                
                return results;
            })()
        `)

        win.close()

        return {
            success: true,
            results: results.slice(0, maxResults),
        }
    } catch (error) {
        win.close()
        throw error
    }
}

// Serper.dev API (Google Search - 可选)
async function searchWithSerper(query: string, apiKey: string, maxResults: number): Promise<WebSearchResult> {
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            q: query,
            num: maxResults,
        })

        const options = {
            hostname: 'google.serper.dev',
            port: 443,
            path: '/search',
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => data += chunk)
            res.on('end', () => {
                try {
                    const json = JSON.parse(data)
                    const results: SearchResult[] = []

                    if (json.organic) {
                        for (const item of json.organic.slice(0, maxResults)) {
                            results.push({
                                title: item.title || '',
                                url: item.link || '',
                                snippet: item.snippet || '',
                            })
                        }
                    }

                    resolve({ success: true, results })
                } catch {
                    resolve({ success: false, error: 'Failed to parse Serper response' })
                }
            })
        })

        req.on('error', (error) => {
            resolve({ success: false, error: `Serper request failed: ${error.message}` })
        })

        req.write(postData)
        req.end()
    })
}

// Tavily API (专为 AI 设计的搜索 - 可选)
async function searchWithTavily(query: string, apiKey: string, maxResults: number): Promise<WebSearchResult> {
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            api_key: apiKey,
            query: query,
            max_results: maxResults,
            include_answer: false,
        })

        const options = {
            hostname: 'api.tavily.com',
            port: 443,
            path: '/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => data += chunk)
            res.on('end', () => {
                try {
                    const json = JSON.parse(data)
                    const results: SearchResult[] = []

                    if (json.results) {
                        for (const item of json.results.slice(0, maxResults)) {
                            results.push({
                                title: item.title || '',
                                url: item.url || '',
                                snippet: item.content || '',
                            })
                        }
                    }

                    resolve({ success: true, results })
                } catch {
                    resolve({ success: false, error: 'Failed to parse Tavily response' })
                }
            })
        })

        req.on('error', (error) => {
            resolve({ success: false, error: `Tavily request failed: ${error.message}` })
        })

        req.write(postData)
        req.end()
    })
}

// ===== 注册 IPC Handlers =====

export function registerHttpHandlers() {
    // 读取 URL 内容
    ipcMain.handle('http:readUrl', async (_event, url: string, timeout?: number) => {
        logger.ipc.info('[HTTP] Reading URL:', url)
        return fetchUrl(url, timeout)
    })

    // 网络搜索
    ipcMain.handle('http:webSearch', async (_event, query: string, maxResults?: number) => {
        logger.ipc.info('[HTTP] Web search:', query)
        return webSearch(query, maxResults)
    })

    // 配置搜索 API (可选)
    ipcMain.handle('http:setSearchApi', async (_event, type: 'serper' | 'tavily', key: string) => {
        setSearchApiKey(type, key)
        return { success: true }
    })

    logger.ipc.info('[HTTP] IPC handlers registered')
}



