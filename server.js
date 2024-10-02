const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');  // Adicione esta linha

const app = express();
const port = 3000;

app.use(cors());  // Use o middleware cors

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Will1407.',
    database: 'lol_champions'
};

app.get('/api/counters/:championName', async (req, res) => {
    const { championName } = req.params;
    console.log(`Recebida requisição para counters de: ${championName}`);

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            'SELECT counter, win_rate FROM tabela_counters WHERE champion = ? ORDER BY win_rate DESC LIMIT 5',
            [championName]
        );
        await connection.end();

        console.log(`Counters encontrados para ${championName}:`, rows);
        res.json({ counters: rows });
    } catch (error) {
        console.error('Erro ao buscar counters:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${port}`);
});