import axios from "axios";
import { TIMEOUT } from "../types/constants";


import * as https from 'https';

export const apiClient = axios.create({
  timeout: TIMEOUT,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Bypass SSL certificate validation issues
    keepAlive: true,
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Shopify-Products-Fetcher/1.0)',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  },
});

