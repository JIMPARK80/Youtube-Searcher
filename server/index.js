import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SERPAPI_KEY) {
    console.warn('⚠️ SERPAPI_KEY 환경 변수가 설정되지 않았습니다. 프록시 요청이 실패할 수 있습니다.');
}

app.use(cors());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/serp', async (req, res) => {
    try {
        const query = (req.query.q || '').toString().trim();
        if (!query) {
            return res.status(400).json({ error: 'Missing required query parameter "q".' });
        }

        if (!SERPAPI_KEY) {
            return res.status(500).json({ error: 'Server is missing SERPAPI_KEY configuration.' });
        }

        const params = new URLSearchParams({
            engine: 'youtube',
            search_query: query,
            api_key: SERPAPI_KEY
        });

        // Pass-through optional parameters (e.g., location, filters)
        const passthroughParams = ['gl', 'hl', 'location', 'search_type', 'sort_by'];
        passthroughParams.forEach((param) => {
            if (req.query[param]) {
                params.set(param, req.query[param]);
            }
        });

        const serpUrl = `https://serpapi.com/search.json?${params.toString()}`;
        const serpResponse = await fetch(serpUrl);

        if (!serpResponse.ok) {
            const errorBody = await serpResponse.text();
            console.error('SerpAPI responded with error:', serpResponse.status, errorBody);
            return res.status(serpResponse.status).json({
                error: 'SerpAPI request failed',
                status: serpResponse.status,
                body: errorBody
            });
        }

        const data = await serpResponse.json();
        res.json(data);
    } catch (error) {
        console.error('Failed to fetch SerpAPI data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ SerpAPI proxy server running on http://localhost:${PORT}`);
});

