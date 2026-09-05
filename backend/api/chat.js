import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
    const { message } = await req.json();

    // 1. Bazadan bütün aktiv ehtiyat hissələrini götürürük
    const { data: products } = await supabase
        .from('products')
        .select('id, title, oem_code, brand, model, years, price, stock, description');

    // 2. AI-ya Sistem Təlimatı (System Prompt) veririk
    const systemPrompt = `
    Sən "AutoParts" ehtiyat hissələri mağazasının ekspert AI köməkçisisən.
    Sənin məqsədin müştəriyə avtomobilinə uyğun ehtiyat hissəsini tapmaqda kömək etməkdir.

    Bazada olan hazırkı məhsullar siyahısı:
    ${JSON.stringify(products)}

    QAYDALAR:
    1. Əgər müştəri avtomobilinin Markasını, Modelini və İlin tam qeyd etməyibsə, nəzakətlə bunları soruş.
    2. Əgər müştəri məhsul haqqında soruşursa, bazadakı məhsullarla müqayisə et və 100% uyğun gələni tap.
    3. Uyğun məhsul tapıldıqda məhsulun Adını, OEM kodunu, Qiymətini və Stokda olub-olmadığını göstər.
    4. Əgər bazada həmin avtomobil üçün uyğun hissə yoxdursa, bunu dəqiq qeyd et və alternativ təklif et.
    5. Cavabları qısa, aydın və peşəkar ver.
    `;

    // 3. OpenAI modelinə sorğu
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
    });

    return Response.json({ reply: completion.choices[0].message.content });
}