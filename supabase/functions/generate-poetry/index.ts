import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, type } = await req.json();
    
    if (!topic) {
      throw new Error('الموضوع مطلوب');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = '';
    
    switch(type) {
      case 'عمودي':
        systemPrompt = 'أنت شاعر عربي متمكن في الشعر العمودي الكلاسيكي. اكتب قصيدة عمودية جميلة بالعربية الفصحى مع الالتزام بالوزن والقافية. القصيدة يجب أن تكون من 6-8 أبيات على الأقل.';
        break;
      case 'حر':
        systemPrompt = 'أنت شاعر عربي متمكن في الشعر الحر. اكتب قصيدة حرة جميلة ومعبرة بالعربية الفصحى. القصيدة يجب أن تكون متوسطة الطول.';
        break;
      case 'نبطي':
        systemPrompt = 'أنت شاعر نبطي متمكن. اكتب قصيدة نبطية جميلة باللهجة الخليجية مع الالتزام بالوزن والقافية. القصيدة يجب أن تكون من 6-8 أبيات على الأقل.';
        break;
      default:
        systemPrompt = 'أنت شاعر عربي متمكن. اكتب قصيدة جميلة ومعبرة بالعربية. القصيدة يجب أن تكون متوسطة الطول.';
    }

    console.log('Generating poetry for topic:', topic, 'type:', type);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `اكتب قصيدة عن: ${topic}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد إلى حسابك" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "خطأ في إنشاء الشعر" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const poetry = data.choices?.[0]?.message?.content;

    if (!poetry) {
      throw new Error("فشل في إنشاء الشعر");
    }

    console.log('Poetry generated successfully');

    return new Response(
      JSON.stringify({ poetry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-poetry:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
