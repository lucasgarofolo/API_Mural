// supabaseClient.js

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Pega a URL e a Chave de Serviço do arquivo .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Cria e exporta o cliente Supabase para ser usado em outras partes da API
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;