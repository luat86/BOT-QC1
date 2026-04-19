import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Bot, MessageSquare, Menu, X, Plus, Trash2,
  Check, Copy, Briefcase, ChevronRight, Loader2, ListChecks
} from 'lucide-react';

const CONSTRUCTION_TASKS = [
  "Trắc đạc công trình",
  "Đào đất hố móng",
  "Gia thiết nền móng",
  "Gia công, lắp dựng cốt thép",
  "Gia công, lắp dựng ván khuôn",
  "Đổ bê tông",
  "Xây tường gạch",
  "Trát tường",
  "Lát nền, ốp lát thuật",
  "Sơn bả tường",
  "Thi công hệ thống điện",
  "Thi công cấp thoát nước",
  "Công tác chống thấm"
];

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ... Formatting component ...
const parseBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const parts = content.split(/(?=## CĂN CỨ TIÊU CHUẨN|## NỘI DUNG CHECKLIST)/g);

  const toggleCheck = (index: string) => {
    setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const renderSection = (text: string, sectionIdx: number) => {
    const lines = text.split('\n');
    const header = lines[0].startsWith('##') ? lines[0].replace('## ', '') : null;
    const bodyLines = header ? lines.slice(1) : lines;

    return (
      <div key={sectionIdx} className={`rounded-2xl border overflow-hidden mb-4 ${header ? 'bg-white border-gray-100 shadow-sm' : ''}`}>
        {header && (
          <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            {header.includes('TIÊU CHUẨN') ? <Briefcase size={16} className="text-indigo-600" /> : <ListChecks size={16} className="text-emerald-600" />}
            <h3 className="text-xs font-black text-gray-700 tracking-wider uppercase">{header}</h3>
          </div>
        )}
        <div className="p-4 space-y-1">
          {bodyLines.map((line, lineIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={lineIdx} className="h-2" />;
            const globalIdx = `${sectionIdx}-${lineIdx}`;

            if (trimmed.startsWith('### ')) {
              return <h4 key={lineIdx} className="text-sm font-bold text-gray-800 mt-3 mb-1">{trimmed.replace('### ', '')}</h4>;
            }

            const checklistMatch = trimmed.match(/^[\*\-]\s\[([ xX])\]\s(.*)/);
            if (checklistMatch) {
              const isChecked = checkedItems[globalIdx] || checklistMatch[1].toLowerCase() === 'x';
              const text = checklistMatch[2];
              return (
                <div 
                  key={lineIdx} 
                  className="flex items-start gap-3 my-1.5 group cursor-pointer"
                  onClick={() => toggleCheck(globalIdx)}
                >
                  <div className={`mt-1 w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all duration-200
                    ${isChecked 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                      : 'bg-white border-gray-300 group-hover:border-indigo-400'}`}>
                    {isChecked && <Check size={12} strokeWidth={4} />}
                  </div>
                  <span className={`leading-relaxed text-[14px] transition-colors duration-200 ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {parseBold(text)}
                  </span>
                </div>
              );
            }

            const bulletMatch = trimmed.match(/^[\*\-]\s(.*)/);
            if (bulletMatch) {
              return (
                <div key={lineIdx} className="flex items-start gap-3 my-1 ml-1 text-[14px]">
                  <span className="mt-2.5 w-1 h-1 bg-indigo-400 rounded-full flex-shrink-0" />
                  <span className="leading-relaxed text-gray-700">{parseBold(bulletMatch[1])}</span>
                </div>
              );
            }

            return <div key={lineIdx} className="leading-relaxed text-gray-700 text-[14px]">{parseBold(trimmed)}</div>;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {parts.map((part, idx) => renderSection(part, idx))}
    </div>
  );
};

// ... callGemini function ...

async function callGemini(prompt: string, history: Message[], apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("Chưa có cấu hình API Key.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstructionText = `BẠN LÀ CHUYÊN GIA QC XÂY DỰNG CAO CẤP TẠI VIỆT NAM.
Nhiệm vụ DUY NHẤT của bạn là lập checklist nghiệm thu giai đoạn thi công cho các hạng mục xây dựng theo đúng các TCVN hiện hành.

QUY CÁCH PHẢN HỒI:
1. BẮT BUỘC chia phản hồi thành 2 phần rõ rệt:
   - Phần 1: ## CĂN CỨ TIÊU CHUẨN (Liệt kê các TCVN áp dụng).
   - Phần 2: ## NỘI DUNG CHECKLIST (Phân chia 3 giai đoạn: Trước, Trong và Sau thi công dùng định dạng - [ ] ).
2. Luôn xuất ra checklist dùng cú pháp Markdown đúng chuẩn: "- [ ] Nội dung kiểm tra".
3. Trả lời trực tiếp vào vấn đề, không vòng vo, không cần chào hỏi.`;

  const contents: any[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  if (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }
  
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: systemInstructionText,
        temperature: 0.1
      }
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('404')) {
      throw new Error("Lỗi: Không tìm thấy Model hoặc cấu hình API Key không hợp lệ.");
    }
    if (error.message?.includes('401')) {
      throw new Error("Lỗi: API Key không chính xác hoặc đã hết hạn.");
    }
    if (error.message?.includes('429')) {
      throw new Error("Lỗi: Quá nhiều yêu cầu. Vui lòng thử lại sau.");
    }
    throw new Error(error.message || "Lỗi không xác định khi gọi AI.");
  }
}

// ... MessageBubble component ...
const MessageBubble = memo(({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border
            ${isError ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-600 text-white border-indigo-500'}`}>
            <Bot size={16} />
          </div>
        )}

        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}>
          <div className={`relative px-4 py-3 shadow-sm text-[15px] group/bubble overflow-hidden transition-all
            ${isUser 
              ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-indigo-100' 
              : isError
                ? 'bg-red-50 text-red-700 border border-red-200 rounded-2xl rounded-bl-sm p-4 text-sm font-medium'
                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-sm'
            }`}>
            
            {isUser ? (
                <div className="whitespace-pre-wrap leading-relaxed font-medium">{message.content}</div>
            ) : (
                <FormattedContent content={message.content} />
            )}

            {!isUser && !isError && (
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-50 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 px-1 font-bold uppercase tracking-tighter opacity-70">
            {formatDate(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

export default function GeminiQCApp() {
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('gemini_api_key_qc') || '');
  const [showLogin, setShowLogin] = useState(!localStorage.getItem('gemini_api_key_qc'));
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    const saved = localStorage.getItem('gemini_qc_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('gemini_qc_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const createNewSession = () => {
    const newId = generateId();
    const newSession: ChatSession = {
      id: newId,
      title: 'Checklist mới',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id && newSessions.length > 0) {
      setCurrentSessionId(newSessions[0].id);
    } else if (newSessions.length === 0) {
      createNewSession();
    }
  };

  const clearCurrentSession = () => {
    if (window.confirm("Xác nhận xóa toàn bộ tin nhắn trong phiên này?")) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [] } : s));
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = (textOverride || input).trim();
    if (!textToSend || !currentSessionId || isLoading) return;

    if (!userApiKey) {
        setShowLogin(true);
        return;
    }

    let prompt = textToSend;
    if (!prompt.toLowerCase().includes("checklist")) {
        prompt = `Lập checklist nghiệm thu giai đoạn thi công cho công tác: ${textToSend}`;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    const isFirst = messages.length === 0;
    
    setSessions(prev => prev.map(s => s.id === currentSessionId ? {
      ...s,
      messages: newMessages,
      title: isFirst ? textToSend.slice(0, 30) : s.title,
      updatedAt: Date.now()
    } : s));

    setInput('');
    setIsLoading(true);

    try {
      const responseText = await callGemini(prompt, messages.slice(-5), userApiKey);
      const botMsg: Message = {
        id: generateId(),
        role: 'model',
        content: responseText,
        timestamp: Date.now()
      };
      
      setSessions(prev => prev.map(s => s.id === currentSessionId ? {
        ...s,
        messages: [...newMessages, botMsg],
        updatedAt: Date.now()
      } : s));
    } catch (err: any) {
      const errMsg: Message = {
        id: generateId(),
        role: 'model',
        content: err.message || "Đã xảy ra lỗi không mong muốn.",
        timestamp: Date.now(),
        isError: true
      };
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...newMessages, errMsg] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-[#f8f9fa] font-sans overflow-hidden">
      
      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border border-gray-100"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
                  <Bot className="text-indigo-600 w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Đăng nhập</h2>
                <p className="text-gray-500 text-sm mt-3 font-medium opacity-70">Cung cấp Gemini API Key để khởi tạo trợ lý</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="password"
                  id="api-key-login"
                  placeholder="Dán API Key của bạn..."
                  className="w-full px-6 py-5 bg-gray-50 border border-gray-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                />
                <button 
                  onClick={() => {
                      const val = (document.getElementById('api-key-login') as HTMLInputElement).value.trim();
                      if (val) {
                        setUserApiKey(val);
                        localStorage.setItem('gemini_api_key_qc', val);
                        setShowLogin(false);
                      }
                      else alert("Vui lòng nhập API Key");
                  }}
                  className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-100 mt-2"
                >
                  Xác nhận
                </button>
                <div className="text-center pt-4">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 text-[11px] font-black uppercase tracking-widest hover:underline opacity-60">Lấy API Key tại đây</a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Trái */}
      <div className={`absolute md:relative z-40 inset-y-0 left-0 w-72 bg-white border-r border-gray-100 transform transition-transform duration-500 flex flex-col shadow-2xl md:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-gray-50 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <ListChecks size={18} />
             </div>
             <span className="font-black text-gray-900 text-sm tracking-tight uppercase">Lịch sử</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <button onClick={createNewSession} className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"><Plus size={18} /> Tạo phiên mới</button>
          <button 
            onClick={() => {
                localStorage.removeItem('gemini_api_key_qc');
                setUserApiKey('');
                setShowLogin(true);
            }} 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all opacity-60"
          >
            Đăng xuất API Key
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
          {sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${s.id === currentSessionId ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700 font-black' : 'hover:bg-gray-50 border-transparent text-gray-500 font-bold'}`}
            >
              <span className="truncate pr-2 text-[13px]">{s.title}</span>
              <button 
                onClick={(e) => deleteSession(s.id, e)} 
                className={`p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all ${s.id === currentSessionId ? 'opacity-100 text-red-400' : 'opacity-0 group-hover:opacity-100 text-gray-300'}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-white md:max-w-4xl mx-auto shadow-2xl md:border-x border-gray-50">
        <header className="h-20 border-b border-gray-50 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-all"><Menu size={20} /></button>
            <div className="flex flex-col">
              <h1 className="text-[17px] font-black text-gray-900 leading-tight uppercase tracking-tighter">Bot QC Nghiệm thu</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-emerald-600 font-black tracking-widest uppercase opacity-80">On-site Assistant</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button 
                onClick={clearCurrentSession}
                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                title="Xóa hội thoại"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button 
              onClick={() => setIsTaskSidebarOpen(true)} 
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100"
            >
              <Briefcase size={16} /> <span className="hidden sm:inline">Danh mục</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#fcfcfc] space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-[0_20px_50px_rgba(79,70,229,0.15)] border border-indigo-50 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                <ListChecks className="w-14 h-14 text-indigo-600" />
              </motion.div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight uppercase leading-none">Trợ lý<br/>nghiệm thu</h2>
              <p className="text-sm text-gray-500 mb-12 font-bold leading-relaxed opacity-60">Chọn hạng mục bên dưới hoặc nhập nội dung công tác để khởi tạo checklist chuẩn TCVN.</p>
              
              <div className="grid grid-cols-1 gap-3 w-full">
                 {CONSTRUCTION_TASKS.slice(0,4).map((task, i) => (
                    <motion.button 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleSend(task)}
                      className="px-6 py-5 bg-white border border-gray-100 rounded-3xl text-[14px] font-black text-left text-gray-700 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm hover:shadow-[0_15px_30px_rgba(79,70,229,0.1)] active:scale-95 group flex items-center justify-between"
                    >
                      {task}
                      <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
                    </motion.button>
                 ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pb-12 pt-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                  />
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-indigo-600 px-6 font-black text-[11px] tracking-[0.2em] uppercase mt-6 mb-2"
                >
                  <Loader2 size={16} className="animate-spin" /> Bot đang lập checklist...
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-50 z-20 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Nhập hạng mục thi công..."
                className="w-full bg-gray-50 border border-gray-200 rounded-3xl px-8 py-5 focus:outline-none focus:ring-[6px] focus:ring-indigo-50/50 focus:border-indigo-500 transition-all font-bold text-[15px] text-gray-800 placeholder-gray-400 shadow-sm"
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="p-5 bg-indigo-600 text-white rounded-3xl shadow-[0_15px_30px_rgba(79,70,229,0.25)] hover:bg-indigo-700 disabled:bg-gray-200 disabled:shadow-none transition-all active:scale-90 flex-shrink-0"
            >
              <Send size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Phải: Danh mục */}
      <AnimatePresence>
        {isTaskSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTaskSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-80 bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col z-50 border-l border-gray-50"
            >
              <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <Briefcase size={20} className="text-emerald-500" />
                   <span className="font-black text-gray-900 text-sm tracking-tight uppercase">Danh mục công tác</span>
                 </div>
                 <button onClick={() => setIsTaskSidebarOpen(false)} className="p-2.5 hover:bg-gray-200 rounded-xl text-gray-400 transition-all"><X size={22} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/20">
                 {CONSTRUCTION_TASKS.map((task, i) => (
                   <button
                      key={i}
                      onClick={() => { handleSend(task); setIsTaskSidebarOpen(false); }}
                      className="w-full text-left px-5 py-5 rounded-[1.5rem] border border-transparent text-[14px] text-gray-700 font-bold hover:bg-white hover:text-indigo-700 hover:border-indigo-100 hover:shadow-xl flex items-center justify-between group transition-all"
                   >
                      {task}
                      <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-all translate-x-3 group-hover:translate-x-0" />
                   </button>
                 ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
