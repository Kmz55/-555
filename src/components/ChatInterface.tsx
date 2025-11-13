import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Bot, User, Image as ImageIcon, Archive, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("chatHistories");
    if (saved) {
      setChatHistories(JSON.parse(saved));
    }
  }, []);

  const saveCurrentChat = () => {
    if (messages.length === 0) return;
    
    const chatId = currentChatId || Date.now().toString();
    const title = messages[0]?.content.slice(0, 50) || "محادثة جديدة";
    
    const newHistory: ChatHistory = {
      id: chatId,
      title,
      messages,
      timestamp: Date.now()
    };

    const updated = chatHistories.filter(h => h.id !== chatId);
    updated.unshift(newHistory);
    
    setChatHistories(updated);
    localStorage.setItem("chatHistories", JSON.stringify(updated));
    setCurrentChatId(chatId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "خطأ",
          description: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSelectedImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const streamChat = async (userMessage: string) => {
    const userMsg: Message = { 
      role: "user" as const, 
      content: userMessage,
      images: selectedImages.length > 0 ? selectedImages : undefined
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);
    setSelectedImages([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("فشل في الاتصال بالخادم");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let textBuffer = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantMessage += content;
              setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);
            }
          } catch (e) {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantMessage += content;
              setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);
            }
          } catch {}
        }
      }

    } catch (error: any) {
      console.error("Error in chat:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إرسال الرسالة",
        variant: "destructive",
      });
      setMessages(newMessages);
    } finally {
      setIsLoading(false);
      saveCurrentChat();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;

    const userMessage = input.trim() || "ما هذا في الصورة؟";
    setInput("");
    await streamChat(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const loadChat = (history: ChatHistory) => {
    setMessages(history.messages);
    setCurrentChatId(history.id);
    setShowArchive(false);
  };

  const deleteChat = (id: string) => {
    const updated = chatHistories.filter(h => h.id !== id);
    setChatHistories(updated);
    localStorage.setItem("chatHistories", JSON.stringify(updated));
    if (currentChatId === id) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowArchive(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      {/* Archive Sidebar */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 w-80 bg-card border-l border-border transform transition-transform duration-300 ease-in-out",
        showArchive ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">الأرشيف</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowArchive(false)}>
              ✕
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {chatHistories.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">لا توجد محادثات محفوظة</p>
            ) : (
              <div className="space-y-2">
                {chatHistories.map((history) => (
                  <Card
                    key={history.id}
                    className="p-3 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0" onClick={() => loadChat(history)}>
                        <p className="text-sm font-medium text-foreground truncate">{history.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(history.timestamp).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(history.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">المساعد الذكي</h1>
                  <p className="text-sm text-muted-foreground">محادثة ذكية بالعربية مع دعم الصور</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={startNewChat}>
                  <Plus className="h-4 w-4 ml-2" />
                  محادثة جديدة
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowArchive(true)}>
                  <Archive className="h-4 w-4 ml-2" />
                  الأرشيف
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="p-6 rounded-2xl bg-primary/10 mb-4">
                  <Bot className="h-16 w-16 text-primary mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">مرحباً بك!</h2>
                <p className="text-muted-foreground max-w-md">
                  أنا مساعدك الذكي. يمكنني مساعدتك في أي شيء، وأستطيع أيضاً فهم وتحليل الصور!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    )}
                    <Card
                      className={cn(
                        "max-w-[80%] p-4",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card"
                      )}
                    >
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`صورة ${idx + 1}`}
                              className="max-w-xs rounded-lg border border-border"
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </Card>
                    {msg.role === "user" && (
                      <div className="flex-shrink-0">
                        <div className="p-2 rounded-lg bg-primary">
                          <User className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start animate-fade-in">
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <Card className="p-4 bg-card">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto px-4 py-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              {selectedImages.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt={`صورة ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-border" />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك هنا..."
                  className="min-h-[60px] max-h-[200px] resize-none text-base"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={(!input.trim() && selectedImages.length === 0) || isLoading}
                  className="px-6"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
