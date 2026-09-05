import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
    try {
        const { message } = await req.json();

        // 1. Supabase-dən ehtiyat hissələrini çəkirik
        const { data: products } = await supabase
            .from('products')
            .select('id, title, oem_code, brand, model, years, price, stock, description');

        // 2. Sistem Təlimatı və Məlumatlar
        const prompt = `
        Sən "AutoParts" ehtiyat hissələri mağazasının ekspert AI köməkçisisən.
        
        Bazada olan hazırkı məhsullar siyahısı:
        ${JSON.stringify(products)}

        QAYDALAR:
        1. Müştəri avtomobilinin Markasını, Modelini və İlin tam qeyd etməyibsə, nəzakətlə bunları soruş.
        2. Məhsul haqqında soruşduqda bazadakı məhsullarla müqayisə et və uyğun gələni tap.
        3. Uyğun məhsul tapıldıqda Adını, OEM kodunu, Qiymətini və Stok vəziyyətini göstər.
        4. Müştərinin mesajı: "${message}"
        `;

        // 3. Pulsuz Gemini 2.5 Flash modelinə sorğu
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return Response.json({ reply: response.text });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}