/**
 * 代码片段设置组件
 * 管理用户自定义代码模板
 */

import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, Code, Download, Upload, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Input, Select } from '@components/ui'
import { toast } from '@components/common/ToastProvider'
import { snippetService, type CodeSnippet } from '@services/snippetService'
import { Language } from '@renderer/i18n'

interface SnippetSettingsProps {
  language: Language
}

const COMMON_LANGUAGES = [
  { value: '', label: 'All Languages' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'typescriptreact', label: 'TypeScript React' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'javascriptreact', label: 'JavaScript React' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
]

interface SnippetFormData {
  name: string
  prefix: string
  body: string
  description: string
  languages: string[]
}

const defaultFormData: SnippetFormData = {
  name: '',
  prefix: '',
  body: '',
  description: '',
  languages: [],
}

export function SnippetSettings({ language }: SnippetSettingsProps) {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<SnippetFormData>(defaultFormData)
  const [showForm, setShowForm] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSnippets()
  }, [])

  const loadSnippets = () => {
    setSnippets(snippetService.getAll())
  }

  const filteredSnippets = snippets.filter(s => {
    const matchesSearch = !searchQuery || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prefix.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLanguage = !filterLanguage || 
      s.languages.length === 0 || 
      s.languages.includes(filterLanguage)
    return matchesSearch && matchesLanguage
  })

  const handleCreate = () => {
    setEditingId(null)
    setFormData(defaultFormData)
    setShowForm(true)
  }

  const handleEdit = (snippet: CodeSnippet) => {
    if (snippetService.isDefaultSnippet(snippet.id)) {
      toast.warning(language === 'zh' ? '默认片段不可编辑' : 'Default snippets cannot be edited')
      return
    }
    setEditingId(snippet.id)
    setFormData({
      name: snippet.name,
      prefix: snippet.prefix,
      body: snippet.body,
      description: snippet.description || '',
      languages: [...snippet.languages],
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (snippetService.isDefaultSnippet(id)) {
      toast.warning(language === 'zh' ? '默认片段不可删除' : 'Default snippets cannot be deleted')
      return
    }
    if (!confirm(language === 'zh' ? '确定删除此片段？' : 'Delete this snippet?')) return
    
    const success = await snippetService.delete(id)
    if (success) {
      toast.success(language === 'zh' ? '已删除' : 'Deleted')
      loadSnippets()
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.prefix.trim() || !formData.body.trim()) {
      toast.error(language === 'zh' ? '请填写必填字段' : 'Please fill required fields')
      return
    }

    try {
      if (editingId) {
        await snippetService.update(editingId, formData)
        toast.success(language === 'zh' ? '已更新' : 'Updated')
      } else {
        await snippetService.add(formData)
        toast.success(language === 'zh' ? '已创建' : 'Created')
      }
      setShowForm(false)
      setFormData(defaultFormData)
      setEditingId(null)
      loadSnippets()
    } catch (error) {
      toast.error(language === 'zh' ? '保存失败' : 'Save failed')
    }
  }

  const handleExport = () => {
    const json = snippetService.exportSnippets()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snippets.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(language === 'zh' ? '已导出' : 'Exported')
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await snippetService.importSnippets(text)
      toast.success(
        language === 'zh' 
          ? `导入成功 ${result.success} 个，失败 ${result.failed} 个`
          : `Imported ${result.success}, failed ${result.failed}`
      )
      loadSnippets()
    } catch {
      toast.error(language === 'zh' ? '导入失败' : 'Import failed')
    }
    e.target.value = ''
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }))
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={language === 'zh' ? '搜索片段...' : 'Search snippets...'}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={filterLanguage}
            onChange={setFilterLanguage}
            options={COMMON_LANGUAGES}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-1" />
            {language === 'zh' ? '导入' : 'Import'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            {language === 'zh' ? '导出' : 'Export'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {language === 'zh' ? '新建' : 'New'}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Snippet Form */}
      {showForm && (
        <div className="p-6 bg-surface/20 backdrop-blur-md rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text-primary">
              {editingId ? (language === 'zh' ? '编辑片段' : 'Edit Snippet') : (language === 'zh' ? '新建片段' : 'New Snippet')}
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {language === 'zh' ? '名称 *' : 'Name *'}
              </label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="React Function Component"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {language === 'zh' ? '触发前缀 *' : 'Trigger Prefix *'}
              </label>
              <Input
                value={formData.prefix}
                onChange={e => setFormData(prev => ({ ...prev, prefix: e.target.value }))}
                placeholder="rfc"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              {language === 'zh' ? '描述' : 'Description'}
            </label>
            <Input
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={language === 'zh' ? '片段描述...' : 'Snippet description...'}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              {language === 'zh' ? '代码模板 *' : 'Code Template *'}
              <span className="ml-2 text-text-muted/60">
                {language === 'zh' ? '支持 $1, ${1:placeholder} 占位符' : 'Supports $1, ${1:placeholder} placeholders'}
              </span>
            </label>
            <textarea
              value={formData.body}
              onChange={e => setFormData(prev => ({ ...prev, body: e.target.value }))}
              placeholder={`const \${1:name} = () => {\n  \${0}\n}`}
              className="w-full h-40 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-2">
              {language === 'zh' ? '适用语言（留空表示所有语言）' : 'Languages (empty for all)'}
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_LANGUAGES.slice(1).map(lang => (
                <button
                  key={lang.value}
                  onClick={() => toggleLanguage(lang.value)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    formData.languages.includes(lang.value)
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-border text-text-muted hover:border-text-muted'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSave}>
              {language === 'zh' ? '保存' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Snippet List */}
      <div className="space-y-2">
        {filteredSnippets.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <Code className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{language === 'zh' ? '没有找到片段' : 'No snippets found'}</p>
          </div>
        ) : (
          filteredSnippets.map(snippet => {
            const isDefault = snippetService.isDefaultSnippet(snippet.id)
            const isExpanded = expandedIds.has(snippet.id)

            return (
              <div
                key={snippet.id}
                className="bg-surface/20 backdrop-blur-md rounded-xl border border-border overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(snippet.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  )}
                  <Code className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{snippet.name}</span>
                      <code className="px-1.5 py-0.5 text-[10px] bg-accent/10 text-accent rounded">
                        {snippet.prefix}
                      </code>
                      {isDefault && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-white/10 text-text-muted rounded">
                          {language === 'zh' ? '内置' : 'Built-in'}
                        </span>
                      )}
                    </div>
                    {snippet.description && (
                      <p className="text-xs text-text-muted truncate mt-0.5">{snippet.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {!isDefault && (
                      <>
                        <button
                          onClick={() => handleEdit(snippet)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          title={language === 'zh' ? '编辑' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                        </button>
                        <button
                          onClick={() => handleDelete(snippet.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                          title={language === 'zh' ? '删除' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/50">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {snippet.languages.length === 0 ? (
                        <span className="text-[10px] text-text-muted">
                          {language === 'zh' ? '所有语言' : 'All languages'}
                        </span>
                      ) : (
                        snippet.languages.map(lang => (
                          <span key={lang} className="px-2 py-0.5 text-[10px] bg-white/5 text-text-muted rounded">
                            {lang}
                          </span>
                        ))
                      )}
                    </div>
                    <pre className="p-3 bg-black/30 rounded-lg text-xs font-mono text-text-secondary overflow-x-auto">
                      {snippet.body}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
