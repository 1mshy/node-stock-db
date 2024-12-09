import fs from 'fs/promises';
import { exec } from 'child_process';

// List of stock symbols to fetch data for
const stockSymbols = ['IBM', 'AAPL', 'MSFT', 'GOOGL'];
const yahoo_base_url = "https://query1.finance.yahoo.com/v8/finance/chart/";


function yahoo_url(symbol, range = null, interval = "1d", period1 = 0, period2 = Date.now() / 1000) {
    if (range) {
        return `${yahoo_base_url}${symbol}?range=${range}&interval=${interval}`;
    }
    return `${yahoo_base_url}${symbol}?period1=${Math.floor(period1).toFixed(0)}&period2=${Math.floor(period2).toFixed(0)}&interval=${interval}`;
}


/**
 * 
 * @param {YahooStockData} data 
 * @returns {TotalStockData}
 */
export function yahoo_to_structured(data) {
    const key_data = data.chart.result[0];
    const { timestamp, events, meta, indicators } = key_data;
    const { volume, open, high, close, low } = indicators.quote[0];
    const adjusted_close = indicators.adjclose[0].adjclose;
    let total_stock_data = {
        data: [],
        events,
        meta
    };
    for (let i = 0; i < timestamp.length; i++) {
        total_stock_data.data.push({
            datetime: timestamp[i] * 1000, // converting to milliseconds
            volume: volume[i],
            open: open[i],
            high: high[i],
            close: adjusted_close[i],
            low: low[i]
        });
    }
    return total_stock_data;
}

/**
 * @param {String} ticker_symbol 
 * @returns {Promise<{meta:{},values:[]}>}
 * @desc Request historical stock data from the Yahoo API from all time, with intervals of 1 day
 */
export async function request_yahoo_big(ticker_symbol) {
    console.log("requesting " + ticker_symbol)
    const url = yahoo_url(ticker_symbol);
    console.log("requesting: " + url);
    const response = await fetch(url, {
        headers: {
            "User-Agent": "PostmanRuntime/7.39.0",
            "Accept": "*/*",
        }
    }).then((response) => response.json());
    if (response && response.code === 404) {
        console.log("invalid ticker symbol submitted: " + ticker_symbol)
    }
    return response;
}

// Fetch stock data for a single symbol
async function fetchStockData(symbol) {
    const currentDate = Math.floor(Date.now() / 1000); // Current date in seconds since epoch
    try {
        const response = await request_yahoo_big(symbol);
        console.log(response.chart.result[0].meta);
        const data = response.chart.result[0];
        console.log(`Data for ${symbol}:`);
        console.log({
            timestamps: data.timestamp,
            closePrices: data.indicators.quote[0].close,
        });
        return response;
    } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error.message);
    }
    return {};
}

// Fetch stock data for all symbols in the list
async function fetchAllStockData() {
    console.log("Fetching data for all symbols...");
    const known_symbols = await fetch("https://api.nasdaq.com/api/screener/stocks?tableonly=true&offset=0&download=true", {
        headers: {
            "User-Agent": "PostmanRuntime/7.39.0",
            "Accept": "*/*",
        }
    })
        .then((response) => response.json())
        .then((data) => {
            return data.data.rows.map((row) => row.symbol);
        });
    console.log(known_symbols);
    for (const symbol of known_symbols) {
        const data = await fetchStockData(symbol);
        fs.writeFile(`./db/${symbol}.json`, JSON.stringify(data, null, 0));
        exec(`git add . && git commit -m "added ${symbol} to db"`, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
            }
            console.log(stdout);
        });
    }
}

// Start the script
fetchAllStockData();
