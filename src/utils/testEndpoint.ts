import { apiClient } from "./apiClient";

 export const testEndpoint = async (url: string): Promise<boolean> => {
    try {
      const response = await apiClient.head(url);
      return response.status === 200;
    } catch (error:any) {
      console.error(`Endpoint test failed for ${url}:`, error.message);
      return false;
    }
  };
