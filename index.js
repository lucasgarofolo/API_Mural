// index.js

const express = require('express');
const cors = require('cors');
// Importa o cliente supabase configurado
const supabase = require('./supabaseClient');

// Inicializa o app express
const app = express();
// Usa a porta definida no .env ou a porta 3000 como padrão
const port = process.env.PORT || 3000;

// === MIDDLEWARES ===
// Habilita o CORS para permitir requisições de qualquer origem
app.use(cors());
// Habilita o express para entender JSON no corpo das requisições
app.use(express.json());


// === ROTAS ===

// Rota de teste
app.get('/', (req, res) => {
  res.send('API do Mural de Recados está funcionando!');
});

/**
 * @route   GET /recados
 * @desc    Busca todos os recados no banco de dados
 */
app.get('/recados', async (req, res) => {
  try {
    // Usa o cliente supabase para fazer uma query na tabela 'recados'
    const { data, error } = await supabase
      .from('recados')
      .select('*') // seleciona todas as colunas
      .order('data_criacao', { ascending: false }); // ordena do mais novo para o mais antigo

    // Se houver um erro na query do banco, retorna erro 500
    if (error) {
      throw error;
    }

    // Se tudo der certo, retorna os dados com status 200 (OK)
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar recados', details: error.message });
  }
});

/**
 * @route   POST /recados
 * @desc    Adiciona um novo recado no banco de dados
 */
app.post('/recados', async (req, res) => {
  try {
    const { autor, mensagem } = req.body;

    // Validação simples: verifica se os campos foram enviados
    if (!autor || !mensagem) {
      return res.status(400).json({ error: 'Autor e mensagem são obrigatórios.' });
    }

    // Insere o novo recado na tabela 'recados'
    const { data, error } = await supabase
      .from('recados')
      .insert([{ autor, mensagem }])
      .select() // .select() faz com que a query retorne o objeto inserido
      .single(); // .single() retorna o objeto diretamente em vez de uma lista com um item

    // Se houver um erro na inserção, retorna erro 500
    if (error) {
      throw error;
    }

    // Retorna o recado criado com status 201 (Created)
    res.status(201).json(data);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar recado', details: error.message });
  }
});


// === INICIAR SERVIDOR ===
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});