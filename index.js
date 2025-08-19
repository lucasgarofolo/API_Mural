const express = require("express");
const bodyParser = require("body-parser");
const supabase = require("./supabaseClient");
const app = express();
const PORT = 3000;

// Middleware para JSON
app.use(bodyParser.json());

// Rota inicial
app.get("/", (req, res) => {
  res.json({ message: "API FlashDrop funcionando " });
});

// POST /photo -> postar nova foto
app.post("/photo", async (req, res) => {
  const { image_url, latitude, longitude } = req.body;

  if (!image_url || !latitude || !longitude) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  try {
    const { data, error } = await supabase
      .from('photos')
      .insert([
        { 
          image_url, 
          latitude: parseFloat(latitude), 
          longitude: parseFloat(longitude) 
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Erro ao salvar foto:', error);
    res.status(500).json({ error: 'Erro ao salvar a foto' });
  }
});

// GET /photos -> listar todas as fotos ativas
app.get("/photos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar fotos:', error);
    res.status(500).json({ error: 'Erro ao buscar as fotos' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
