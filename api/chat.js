module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages gerekli' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'API key eksik' });

  const groqMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.parts[0].text
  }));

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: "Sen ProtoX'sin. Protocol X yapimcilari tarafindan gelistirildim. Teknoloji, yazilim ve siber guvenlik konularinda uzman bir AI asistansin. YouTube kanalimiz: https://www.youtube.com/@ProtocollX - Teknoloji ve siber guvenlik icerikleri paylasilıyor. Turkce cevap ver. Kisa, net ve anlasılır ol." },
          ...groqMessages
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: 'Groq API hatasi: ' + JSON.stringify(err) });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Cevap uretilemedi.';
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: 'Sunucu hatasi: ' + error.message });
  }
};
