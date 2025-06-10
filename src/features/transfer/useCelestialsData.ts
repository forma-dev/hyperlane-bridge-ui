import { useEffect, useState } from 'react';

interface CelestialsData {
  address: string | null;
  status: 'NOT_VERIFIED' | 'VERIFIED' | 'PRIMARY' | null;
  imageUrl: string | null;
}

interface CelestialResponse {
  celestial: {
    address: string;
    status: 'NOT_VERIFIED' | 'VERIFIED' | 'PRIMARY';
    image_url?: string;
  };
}

export const useCelestialsData = (
  celestialId: string | null | undefined,
): {
  data: CelestialsData | null;
  loading: boolean;
  error: Error | null;
} => {
  const [data, setData] = useState<CelestialsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCelestialsData = async () => {
      if (!celestialId) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`https://api.celestials.id/api/celestials/id/${celestialId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch Celestial details');
        }

        const responseData: CelestialResponse = await response.json();

        if (responseData.celestial) {
          setData({
            address: responseData.celestial.address,
            status: responseData.celestial.status,
            imageUrl: responseData.celestial.image_url || null,
          });
        } else {
          setData({
            address: null,
            status: null,
            imageUrl: null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchCelestialsData();
  }, [celestialId]);

  return { data, loading, error };
};

//for one-off lookups
export const getCelestialsData = async (celestialId: string): Promise<CelestialsData> => {
  const response = await fetch(`https://api.celestials.id/api/celestials/id/${celestialId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch Celestial details');
  }

  const responseData = await response.json();

  // Handle the new response format with addresses array
  if (responseData.addresses && responseData.addresses.length > 0) {
    // Use the first address in the array
    return {
      address: responseData.addresses[0].address,
      status: responseData.addresses[0].status,
      imageUrl: responseData.celestial?.image_url || null,
    };
  }
  // Fallback to the old format
  else if (responseData.celestial) {
    return {
      address: responseData.celestial.address,
      status: responseData.celestial.status,
      imageUrl: responseData.celestial.image_url || null,
    };
  } else if (responseData.address) {
    return {
      address: responseData.address,
      status: responseData.status || null,
      imageUrl: responseData.image_url || null,
    };
  }

  // If no valid data found
  return {
    address: null,
    status: null,
    imageUrl: null,
  };
};
