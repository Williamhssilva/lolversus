const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Servir arquivos estáticos da raiz do projeto
app.use(express.static('.'));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Conectado ao MongoDB Atlas');
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

app.get('/api/counters/:championName', async (req, res) => {
    const { championName } = req.params;
    console.log(`Recebida requisição para counters de: ${championName}`);

    try {
        const database = client.db(process.env.DB_NAME);
        const collection = database.collection('counters');

        // Consulta case-insensitive
        const query = { champion: { $regex: new RegExp('^' + championName + '$', 'i') } };
        console.log('Executando consulta:', JSON.stringify(query));

        const counters = await collection.find(query)
            .sort({ win_rate: -1 })
            .limit(5)
            .toArray();

        console.log(`Counters encontrados para ${championName}:`, counters);

        if (counters.length === 0) {
            console.log(`Nenhum counter encontrado para ${championName}. Verificando todos os documentos na coleção...`);
            
            // Consulta para verificar todos os documentos
            const allDocs = await collection.find({}).limit(10).toArray();
            console.log('Primeiros 10 documentos na coleção:', allDocs);
        }

        res.json({ counters });
    } catch (error) {
        console.error('Erro ao buscar counters:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

connectToDatabase().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
});