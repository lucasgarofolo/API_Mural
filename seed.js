const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_BASE_URL = 'https://api-mural.onrender.com';
const TEMP_FOLDER = './temp';

// Dados mockados com imagens de exemplo
const mockPhotos = [
  {
    url: 'https://images.unsplash.com/photo-1543059080-f9b1272213d5',
    latitude: -23.5505,
    longitude: -46.6333
  },
  {
    url: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325',
    latitude: -22.9068,
    longitude: -43.1729
  },
  {
    url: 'https://images.unsplash.com/photo-1575470522418-b88b692b8084',
    latitude: -19.9167,
    longitude: -43.9345
  }
];

// Cria a pasta temporária se não existir
if (!fs.existsSync(TEMP_FOLDER)) {
  fs.mkdirSync(TEMP_FOLDER, { recursive: true });
}

async function downloadImage(url, index) {
  try {
    const response = await axios({
      method: 'GET',
      url: `${url}?w=1200&auto=format&fit=crop`,
      responseType: 'arraybuffer'
    });

    const filename = `photo-${index + 1}.jpg`;
    const filePath = path.join(TEMP_FOLDER, filename);
    fs.writeFileSync(filePath, response.data);
    return { filePath, filename };
  } catch (error) {
    console.error(`Erro ao baixar imagem ${index + 1}:`, error.message);
    return null;
  }
}

async function uploadPhoto(photo, filePath) {
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath));
    formData.append('latitude', photo.latitude.toString());
    formData.append('longitude', photo.longitude.toString());

    const response = await axios.post(`${API_BASE_URL}/photo`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao enviar foto:', error.response?.data || error.message);
    return null;
  }
}

async function seedDatabase() {
  console.log('🚀 Iniciando seed via API...');

  try {
    console.log('🔄 Verificando conexão com a API...');
    const { data: status } = await axios.get(API_BASE_URL);
    console.log('✅ API está online:', status);

    // Processa cada foto
    for (let i = 0; i < mockPhotos.length; i++) {
      const photo = mockPhotos[i];
      console.log(`📸 Processando imagem ${i + 1} de ${mockPhotos.length}`);
      
      // Baixa a imagem
      const imageData = await downloadImage(photo.url, i);
      if (!imageData) continue;
      
      // Faz upload via API
      console.log(`⬆️  Enviando imagem ${i + 1} para a API...`);
      const result = await uploadPhoto(photo, imageData.filePath);
      
      // Remove o arquivo temporário
      fs.unlinkSync(imageData.filePath);

      if (result) {
        console.log(`✅ Imagem ${i + 1} adicionada com sucesso!`, `ID: ${result.id}`);
      } else {
        console.error(`❌ Falha ao adicionar imagem ${i + 1}`);
      }
    }

    console.log('✨ Seed concluído! Verificando fotos cadastradas...');
    
    // Lista todas as fotos após o seed
    const { data: photos } = await axios.get(`${API_BASE_URL}/photos`);
    console.log(`📊 Total de fotos no sistema: ${photos.length}`);
    console.log('✨ Processo finalizado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o seed:', error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.data);
    }
  } finally {
    // Limpa a pasta temporária
    if (fs.existsSync(TEMP_FOLDER)) {
      fs.rmSync(TEMP_FOLDER, { recursive: true, force: true });
    }
    process.exit(0);
  }
}

// Executa o seed
seedDatabase();