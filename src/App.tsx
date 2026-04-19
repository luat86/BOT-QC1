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
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const lines = content.split('\n');

  const toggleCheck = (index: number) => {
    setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="flex flex-col space-y-1">
      {lines.map((line, currentIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={currentIndex} className="h-2" />;

        if (trimmed.startsWith('### ')) {
            return <h4 key={currentIndex} className="text-base font-bold text-gray-800 mt-3 mb-1">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return <h3 key={currentIndex} className="text-lg font-bold text-indigo-700 mt-4 mb-2">{trimmed.replace(/^#+\s/, '')}</h3>;
        }

        const checklistMatch = trimmed.match(/^[\*\-]\s\[([ xX])\]\s(.*)/);
        if (checklistMatch) {
          const isChecked = checkedItems[currentIndex] || checklistMatch[1].toLowerCase() === 'x';
          const text = checklistMatch[2];
          return (
            <div 
              key={currentIndex} 
              className="flex items-start gap-3 my-1.5 group cursor-pointer"
              onClick={() => toggleCheck(currentIndex)}
            >
              <div className={`mt-1 w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all duration-200
                ${isChecked 
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                  : 'bg-white border-gray-300 group-hover:border-indigo-400'}`}>
                {isChecked && <Check size={12} strokeWidth={4} />}
              </div>
              <span className={`leading-relaxed transition-colors duration-200 ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {parseBold(text)}
              </span>
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[\*\-]\s(.*)/);
        if (bulletMatch) {
          return (
            <div key={currentIndex} className="flex items-start gap-3 my-1 ml-1">
              <span className="mt-2.5 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
              <span className="leading-relaxed text-gray-700">{parseBold(bulletMatch[1])}</span>
            </div>
          );
        }

        return <div key={currentIndex} className="leading-relaxed text-gray-700">{parseBold(trimmed)}</div>;
      })}
    </div>
  );
};

// ... callGemini function ...

async function callGemini(prompt: string, history: Message[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa có cấu hình GEMINI_API_KEY.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstructionText = `BẠN LÀ CHUYÊN GIA QC XÂY DỰNG CAO CẤP TẠI VIỆT NAM.
Nhiệm vụ DUY NHẤT của bạn là lập checklist nghiệm thu giai đoạn thi công cho các hạng mục xây dựng theo đúng các TCVN hiện hành.

QUY CÁCH PHẢN HỒI:
1. Luôn xuất ra checklist dùng cú pháp Markdown đúng chuẩn: "- [ ] Nội dung kiểm tra". Không dùng các ký hiệu khác thay thế cho checklist.
2. Phải chia rõ ràng thành 3 giai đoạn:
   I. Trước khi thi công
   II. Trong quá trình thi công
   III. Sau khi thi công
3. Ở mỗi hạng mục kiểm tra hoặc đầu câu trả lời bắt buộc ghi rõ TCVN (Tiêu chuẩn Việt Nam) áp dụng.
4. Trả lời trực tiếp vào vấn đề, không vòng vo, không cần chào hỏi.`;

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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: systemInstructionText,
      temperature: 0.2
    }
  });

  return response.text || "";
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto mb-8 shadow-sm
            ${isError ? 'bg-red-100 text-red-600' : 'bg-emerald-600 text-white'}`}>
            <Bot size={16} />
          </div>
        )}

        <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}>
          <div className={`relative px-4 py-3 shadow-sm text-[15px] group/bubble overflow-hidden transition-all
            ${isUser 
              ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' 
              : isError
                ? 'bg-red-50 text-red-800 border border-red-100 rounded-2xl rounded-bl-sm'
                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-sm'
            }`}>
            
            {isUser ? (
                <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
            ) : (
                <FormattedContent content={message.content} />
            )}

            {!isUser && !isError && (
              <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-50 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span className="text-xs">{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 px-1 mt-0.5">
            {formatDate(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});


// ... App Component ...
export default function GeminiQCApp() {
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
    const newSession: ChatSession = {
      id: generateId(),
      title: 'Checklist mới',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
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

  const handleSend = async (textOverride?: string) => {
    const textToSend = (textOverride || input).trim();
    if (!textToSend || !currentSessionId || isLoading) return;

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
      title: isFirst ? textToSend.slice(0, 30) + '...' : s.title,
      updatedAt: Date.now()
    } : s));

    setInput('');
    setIsLoading(true);

    try {
      const responseText = await callGemini(prompt, messages.slice(-5));
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
        content: `Lỗi: ${err.message}`,
        timestamp: Date.now(),
        isError: true
      };
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...newMessages, errMsg] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-gray-100 font-sans overflow-hidden">
      
      {/* Sidebar Trái */}
      <div className={`absolute md:relative z-40 inset-y-0 left-0 w-64 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 flex flex-col 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="font-semibold text-gray-700 flex items-center gap-2">
            <ListChecks className="text-indigo-600" />
            Checklist Lịch Sử
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 bg-white">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Plus size={16} /> Phiên mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto w-full p-2 space-y-1">
          {sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }}
              className={`group flex items-center justify-between p-3 flex-shrink-0 w-full min-w-0 rounded-lg cursor-pointer transition-colors ${s.id === currentSessionId ? 'bg-white shadow-sm ring-1 ring-indigo-100 text-indigo-700' : 'hover:bg-gray-200 text-gray-600'}`}
            >
              <span className="truncate pr-2 text-sm font-medium block w-full text-left">{s.title}</span>
              <button 
                onClick={(e) => deleteSession(s.id, e)} 
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-red-500 hover:bg-red-50 p-1 rounded transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-white md:max-w-[70vw] lg:max-w-4xl mx-auto shadow-sm border-l border-r border-gray-200">
        <header className="h-14 border-b border-gray-100 flex items-center justify-between px-3 bg-white/90 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-gray-600"><Menu size={22} /></button>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-bold text-gray-800">Checklist Nghiệm Thu</h1>
              <span className="text-[11px] text-emerald-600">Giai đoạn Thi Công</span>
            </div>
          </div>
          <button 
            onClick={() => setIsTaskSidebarOpen(!isTaskSidebarOpen)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 text-sm font-medium transition-colors"
          >
            <Briefcase size={16} /> <span className="hidden sm:inline">Danh mục</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 bg-[#f4f4f5]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-80 max-w-sm mx-auto">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                <ListChecks className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Checklist Nghiệm Thu Thi Công</h2>
              <p className="text-sm text-gray-500 mb-6">Trợ lý AI giúp lập checklist chuẩn thi công, bám sát các tiêu chuẩn TCVN hiện hành.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:hidden">
                 {/* Visible on Mobile/Tablet */}
                 {CONSTRUCTION_TASKS.slice(0,4).map((task, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSend(task)}
                      className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-left hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
                    >
                      {task}
                    </button>
                 ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pb-4">
              <AnimatePresence>
                {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
              </AnimatePresence>
              {isLoading && (
                <div className="flex items-center gap-3 text-gray-500 px-4">
                  <Loader2 size={16} className="animate-spin text-indigo-600" /> Đang lập checklist...
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="p-3 bg-white border-t border-gray-100 z-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto w-full relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Nhập hạng mục thi công (Vd: Bê tông cột...)"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-sm text-gray-800"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="p-3 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Phải (Danh mục công việc) */}
      <div className={`absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 flex flex-col z-50 shadow-2xl transition-transform duration-300 transform ${isTaskSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between font-semibold text-gray-700">
           <div className="flex items-center gap-2">
             <Briefcase size={16} className="text-emerald-500" /> Danh mục công việc
           </div>
           <button onClick={() => setIsTaskSidebarOpen(false)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
              <X size={18} />
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
           {CONSTRUCTION_TASKS.map((task, i) => (
             <button
                key={i}
                onClick={() => { handleSend(task); setIsTaskSidebarOpen(false); }}
                className="w-full text-left px-4 py-3 rounded-xl border border-transparent text-sm text-gray-700 font-medium hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-100 flex items-center justify-between group transition-all"
             >
                {task}
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />
             </button>
           ))}
        </div>
      </div>
      
      {/* Backdrop cho Sidebar Phải khi mở trên màn hình nhỏ hoặc to đều đè lên nội dung */}
      {isTaskSidebarOpen && (
        <div 
           onClick={() => setIsTaskSidebarOpen(false)}
           className="absolute inset-0 z-40 bg-black/10 backdrop-blur-sm"
        />
      )}

    </div>
  );
}
