import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PoetryGenerator = () => {
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("عمودي");
  const [poetry, setPoetry] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generatePoetry = async () => {
    if (!topic.trim()) {
      toast({
        title: "تنبيه",
        description: "الرجاء إدخال موضوع الشعر",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setPoetry("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-poetry", {
        body: { topic, type },
      });

      if (error) throw error;

      if (data?.poetry) {
        setPoetry(data.poetry);
        toast({
          title: "تم بنجاح",
          description: "تم إنشاء القصيدة بنجاح",
        });
      }
    } catch (error: any) {
      console.error("Error generating poetry:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الشعر",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyPoetry = () => {
    navigator.clipboard.writeText(poetry);
    setCopied(true);
    toast({
      title: "تم النسخ",
      description: "تم نسخ القصيدة إلى الحافظة",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            مولّد الشعر الذكي
          </h1>
          <p className="text-lg text-muted-foreground">اكتب موضوعاً واترك الذكاء الاصطناعي يُبدع لك شعراً جميلاً</p>
        </div>

        <Card className="p-8 border-border/50 shadow-xl backdrop-blur-sm bg-card/80">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">موضوع القصيدة</label>
              <Textarea
                placeholder="مثال: الحب، الوطن، الطبيعة، الشوق..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="min-h-[100px] text-lg resize-none bg-secondary/50 border-border/50 focus:border-primary transition-all"
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نوع الشعر</label>
              <Select value={type} onValueChange={setType} dir="rtl">
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="عمودي">شعر عمودي</SelectItem>
                  <SelectItem value="حر">شعر حر</SelectItem>
                  <SelectItem value="نبطي">شعر نبطي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generatePoetry}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-lg hover:shadow-xl text-lg h-12"
            >
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <Sparkles className="ml-2 h-5 w-5" />
                  إنشاء القصيدة
                </>
              )}
            </Button>
          </div>
        </Card>

        {poetry && (
          <Card className="p-8 border-border/50 shadow-xl backdrop-blur-sm bg-card/80 animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-primary">القصيدة</h2>
                <Button
                  onClick={copyPoetry}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary"
                >
                  {copied ? (
                    <>
                      <Check className="ml-2 h-4 w-4" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="ml-2 h-4 w-4" />
                      نسخ
                    </>
                  )}
                </Button>
              </div>
              <div
                className="text-lg leading-relaxed whitespace-pre-wrap text-foreground font-serif"
                dir="rtl"
              >
                {poetry}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PoetryGenerator;
