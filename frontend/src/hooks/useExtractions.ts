import { useState, useEffect, useCallback } from 'react';
import { extractionService, Extraction, ExtractionFilters } from '../services/extraction.service';

export function useExtractions(initialFilters?: ExtractionFilters) {
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [filters, setFilters] = useState<ExtractionFilters>(initialFilters || {});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExtractions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await extractionService.getExtractions(filters);
      setExtractions(data);
    } catch (err: any) {
      setError('Unable to load AI extractions.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExtractions();
  }, [fetchExtractions]);

  return {
    extractions,
    loading,
    error,
    filters,
    setFilters,
    refetch: fetchExtractions
  };
}
