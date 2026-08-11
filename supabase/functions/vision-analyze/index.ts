import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { image, prompt, lang, textOnly } = body;

    // For non-visual queries (GK, general questions), textOnly=true means no image is needed
    if (!textOnly && !image) {
      return new Response(
        JSON.stringify({ error: "Image data is required for visual analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: configData, error: configError } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "OPENROUTER_API_KEY")
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured in database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = configData.value;

    const defaultPrompt = `You are an AI assistant for visually impaired smart glasses. Analyze this camera frame and respond ONLY with a JSON object (no markdown, no code fences) in this exact format:
{
  "objects": [{"class": "object name", "confidence": 0.0-1.0, "position": "left|center|right", "distance": "Very close|Close|Medium|Far", "distanceMeters": number}],
  "scene": "one sentence scene description",
  "text": "any readable text in the image, or empty string",
  "colors": [{"name": "color name", "hex": "#rrggbb"}],
  "currency": "currency value if detected, or empty string",
  "warning": "obstacle warning if something is very close, or empty string"
}
Detect up to 8 objects. Use lowercase class names. Estimate distance from object size. Be concise.`;

    let activePrompt = prompt || defaultPrompt;
    if (lang && !lang.toLowerCase().startsWith('en')) {
      const langNames: Record<string, string> = {
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'bn': 'Bengali'
      };
      const shortLang = lang.split('-')[0].toLowerCase();
      const langName = langNames[shortLang] || shortLang;
      activePrompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: The user's preferred language is ${langName} (${lang}). 
You MUST respond with completely natural and fluent ${langName} without mixing any English words. Translate all human-readable string values in the JSON output into ${langName} (using the correct regional script, e.g. Devanagari for Hindi, Tamil script for Tamil, etc.). This includes translation of:
- The 'scene' description string (make it sound like a friendly human companion speaking in ${langName})
- The 'text' string (translate any English text read in the image to ${langName} or represent it in ${langName})
- The 'warning' obstacle warning string
- The object 'class' names in the 'objects' array (translate them to standard ${langName} terms)
- The 'currency' string (e.g. '500 ரூபாய்' for Tamil)
Do NOT translate the JSON keys (e.g. keep keys like "objects", "class", "confidence", "position", "distance", "scene", "text", "colors", "currency", "warning" in English). The response MUST still be valid JSON.`;
    }

    // Build message content: text-only for general questions, multimodal for visual analysis
    let messageContent: any[];
    if (textOnly) {
      messageContent = [{ type: "text", text: activePrompt }];
    } else {
      messageContent = [
        { type: "text", text: activePrompt },
        { type: "image_url", image_url: { url: image } },
      ];
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://visionassist.app",
        "X-Title": "VisionAssist",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        max_tokens: textOnly ? 1024 : 800,
        temperature: textOnly ? 0.5 : 0.3,
        // Only force JSON for visual analysis; for text-only Q&A allow free-form
        ...(textOnly ? {} : { response_format: { type: "json_object" } }),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenRouter API error: ${response.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content returned from AI model" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For text-only (GK/general questions), return the raw answer as { answer: "..." }
    if (textOnly) {
      return new Response(
        JSON.stringify({ answer: content.trim() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(
          JSON.stringify({ error: "Could not parse AI response", raw: content }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
