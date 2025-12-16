/**
 * Gemini Provider
 * 支持 Google Gemini 系列模型
 * 支持自定义 baseURL（用于代理或兼容 API）
 */

import { GoogleGenerativeAI, SchemaType, Content } from '@google/generative-ai'
import { BaseProvider } from './base'
import { ChatParams, ToolDefinition, ToolCall } from '../types'

export class GeminiProvider extends BaseProvider {
	private client: GoogleGenerativeAI
	private timeout: number
	private baseUrl?: string

	constructor(apiKey: string, baseUrl?: string, timeout?: number) {
		super('Gemini')
		this.timeout = timeout || 120000 // 默认 2 分钟
		this.baseUrl = baseUrl
		this.log('info', 'Initializing', { timeout: this.timeout, baseUrl: baseUrl || 'default' })
		
		// GoogleGenerativeAI 支持通过 RequestOptions 设置 baseUrl
		// 但构造函数不直接支持，需要在每次请求时传入
		this.client = new GoogleGenerativeAI(apiKey)
	}

	private convertTools(tools?: ToolDefinition[]) {
		if (!tools?.length) return undefined

		const functionDeclarations = tools.map(tool => ({
			name: tool.name,
			description: tool.description,
			parameters: {
				type: SchemaType.OBJECT,
				properties: Object.fromEntries(
					Object.entries(tool.parameters.properties).map(([key, value]) => [
						key,
						{
							type: value.type as SchemaType,
							description: value.description,
							enum: value.enum,
						}
					])
				),
				required: tool.parameters.required,
			}
		}))

		return [{ functionDeclarations }]
	}

	async chat(params: ChatParams): Promise<void> {
		const { model, messages, tools, systemPrompt, onStream, onToolCall, onComplete, onError } = params

		try {
			this.log('info', 'Starting chat', { model, messageCount: messages.length })

			// Note: tools type assertion needed due to Gemini SDK's complex tool type structure
			// Our convertTools returns a compatible structure but TypeScript can't verify it
			// 如果有自定义 baseUrl，通过 requestOptions 传递
			const requestOptions = this.baseUrl ? { baseUrl: this.baseUrl } : undefined
			
			const genModel = this.client.getGenerativeModel({
				model,
				systemInstruction: systemPrompt,
				tools: this.convertTools(tools) as Parameters<typeof this.client.getGenerativeModel>[0]['tools'],
			}, requestOptions)

			// 构建历史记录
			const history: Content[] = []
			let lastUserMessage = ''

			// Helper to convert MessageContent to string
			const contentToString = (content: typeof messages[0]['content']): string => {
				if (typeof content === 'string') return content
				return content.map(part => part.type === 'text' ? part.text : '[image]').join('')
			}

			// Gemini 要求历史记录必须以 user 消息开始
			// 找到第一条 user 消息的索引
			let startIndex = 0
			for (let i = 0; i < messages.length; i++) {
				if (messages[i].role === 'user') {
					startIndex = i
					break
				}
			}

			for (let i = startIndex; i < messages.length; i++) {
				const msg = messages[i]
				if (msg.role === 'user') {
					// 如果不是最后一条 user 消息，加入历史
					const isLastUser = messages.slice(i + 1).every(m => m.role !== 'user')
					if (isLastUser) {
						lastUserMessage = contentToString(msg.content)
					} else {
						history.push({
							role: 'user',
							parts: [{ text: contentToString(msg.content) }]
						})
					}
				} else if (msg.role === 'assistant') {
					if (msg.toolName) {
						history.push({
							role: 'model',
							parts: [{
								functionCall: {
									name: msg.toolName,
									args: JSON.parse(contentToString(msg.content)),
								}
							}]
						})
					} else {
						history.push({
							role: 'model',
							parts: [{ text: contentToString(msg.content) }]
						})
					}
				} else if (msg.role === 'tool') {
					history.push({
						role: 'user',
						parts: [{
							functionResponse: {
								name: msg.toolName || '',
								response: { result: contentToString(msg.content) }
							}
						}]
					})
				}
			}

			// 确保 history 以 user 开始（如果有历史的话）
			// 如果 history 为空或第一条不是 user，需要处理
			if (history.length > 0 && history[0].role !== 'user') {
				// 在开头插入一个占位 user 消息
				history.unshift({
					role: 'user',
					parts: [{ text: 'Continue the conversation.' }]
				})
			}

			// 如果没有 lastUserMessage，使用默认值
			if (!lastUserMessage) {
				lastUserMessage = 'Continue.'
			}

			// 发起流式请求
			const chat = genModel.startChat({ history })
			const result = await chat.sendMessageStream(lastUserMessage)

			let fullContent = ''
			const toolCalls: ToolCall[] = []

			for await (const chunk of result.stream) {
				const text = chunk.text()
				if (text) {
					fullContent += text
					onStream({ type: 'text', content: text })
				}

				// 检查函数调用
				const candidate = chunk.candidates?.[0]
				if (candidate?.content?.parts) {
					for (const part of candidate.content.parts) {
						if ('functionCall' in part && part.functionCall) {
							const toolCall: ToolCall = {
								id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`,
								name: part.functionCall.name,
								arguments: part.functionCall.args as Record<string, unknown>,
							}
							toolCalls.push(toolCall)
							onToolCall(toolCall)
						}
					}
				}
			}

			this.log('info', 'Chat complete', {
				contentLength: fullContent.length,
				toolCallCount: toolCalls.length
			})

			onComplete({
				content: fullContent,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined
			})

		} catch (error: unknown) {
			const llmError = this.parseError(error)
			this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
			onError(llmError)
		}
	}
}
