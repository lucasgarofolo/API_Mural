const express = require("express");
const bodyParser = require("body-parser");
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do multer para upload de arquivos
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors()); // Habilita CORS para todas as rotas
app.use(bodyParser.json());
app.use(express.static('public'));

// Rota GET / - Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota GET /photos - Lista todas as fotos
app.get("/photos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Adiciona a URL completa de cada imagem
    const photosWithUrls = data.map(photo => ({
      ...photo,
      image_url: supabase.storage
        .from('mural')
        .getPublicUrl(photo.file_path).data.publicUrl
    }));

    res.json(photosWithUrls);
  } catch (error) {
    console.error('Erro ao buscar fotos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar as fotos',
      details: error.message 
    });
  }
});

// Rota POST /photo - Faz upload de uma nova foto
app.post("/photo", upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    if (!file || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Dados incompletos. Envie uma imagem e as coordenadas.' 
      });
    }

    // Gera um nome único para o arquivo
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `photos/${fileName}`;

    // Faz upload da imagem para o Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('mural')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Obtém a URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from('mural')
      .getPublicUrl(filePath);

    // Insere os metadados da foto no banco de dados
    const { data, error: dbError } = await supabase
      .from('photos')
      .insert([
        { 
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          file_path: filePath
        }
      ])
      .select('*');

    if (dbError) throw dbError;

    // Retorna os dados da foto salva com a URL da imagem
    res.status(201).json({
      ...data[0],
      image_url: publicUrl
    });

  } catch (error) {
    console.error('Erro ao processar a foto:', error);
    res.status(500).json({ 
      error: 'Erro ao processar a foto',
      details: error.message 
    });
  }
});

// Rota POST /api/editar-imagem - Editor de imagens com IA
app.post('/api/editar-imagem', upload.single('imagem'), async (req, res) => {
  try {
    const file = req.file;
    const { tema } = req.body;

    if (!file || !tema) {
      return res.status(400).json({
        error: 'Dados incompletos. Envie a imagem (campo: imagem) e o tema (campo: tema).'
      });
    }

    // Converte o buffer para Data URL Base64 com prefixo MIME
    const mimeType = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Passo 1: Análise da imagem (GPT-4o)
    const analysisPrompt = 'Descreva esta imagem em detalhes para que um artista de IA possa recriá-la.';

    const chatPayload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente especializado em descrever imagens de forma minuciosa, objetiva e útil para recriação por IA.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    };

    const chatResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      chatPayload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const descricaoGerada = chatResponse?.data?.choices?.[0]?.message?.content?.trim();

    if (!descricaoGerada) {
      return res.status(502).json({
        error: 'Falha ao obter descrição da imagem pela IA.'
      });
    }

    // Passo 2: Geração da nova imagem (DALL-E 3)
    const promptFinal = `${descricaoGerada}\nA imagem deve ser recriada no seguinte estilo: ${tema}.`;

    const imageGenPayload = {
      model: "dall-e-2",
      prompt: promptFinal,
      size: '300x300'
    };

    const imageResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      imageGenPayload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const novaImagemUrl = imageResponse?.data?.data?.[0]?.url;

    if (!novaImagemUrl) {
      return res.status(502).json({
        error: 'Falha ao gerar a nova imagem com o DALL-E 3.'
      });
    }

    return res.status(200).json({ novaImagemUrl });
  } catch (error) {
    // Log estendido para diagnóstico
    const apiErrorData = error?.response?.data;
    console.error('Erro em /api/editar-imagem:', {
      message: error?.message,
      status: error?.response?.status,
      data: apiErrorData
    });

    return res.status(500).json({
      error: 'Erro ao processar a edição da imagem com IA.',
      details: error?.message,
      api: error?.response?.data
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
