const express = require("express");
const bodyParser = require("body-parser");
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

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
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Rota POST /photo - Faz upload de uma nova foto
app.post('/photo', upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    // Validação dos dados
    if (!file || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Dados incompletos. Envie uma imagem, latitude e longitude.' 
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

    // Retorna os dados da foto salva
    res.status(201).json({
      id: data[0].id,
      latitude: data[0].latitude,
      longitude: data[0].longitude,
      file_path: data[0].file_path,
      created_at: data[0].created_at,
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

// Rota GET /photos - Lista todas as fotos
app.get('/photos', async (req, res) => {
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

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'API do Mural está funcionando! 📸' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
