import { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { Pokemon } from '../types/pokemon';
import { DatabaseService, DatabasePokemon } from '../services/databaseService';

// Преобразование DatabasePokemon в Pokemon для совместимости
const convertDatabasePokemonToPokemon = (dbPokemon: DatabasePokemon): Pokemon => ({
  id: dbPokemon.id,
  name: dbPokemon.name,
  url: `https://pokeapi.co/api/v2/pokemon/${dbPokemon.id}/`,
  height: dbPokemon.height,
  weight: dbPokemon.weight,
  types: dbPokemon.types,
  abilities: dbPokemon.abilities,
  stats: dbPokemon.stats,
  sprites: dbPokemon.sprites,
  species: dbPokemon.species_url ? { url: dbPokemon.species_url } : undefined,
  // Добавляем поля для новых функций
  new_until: (dbPokemon as any).new_until,
  is_hidden: (dbPokemon as any).is_hidden
});

// Хук для получения списка покемонов из базы данных с мемоизацией
export const usePokemonList = () => {
  const [pokemonList, setPokemonList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchPokemonList = useCallback(async () => {
    try {
      setLoading(true);
      const dbPokemon = await DatabaseService.getAllPokemon();
      // Фильтруем только видимых покемонов для обычных пользователей
      const visiblePokemon = dbPokemon.filter(p => !(p as any).is_hidden);
      setPokemonList(visiblePokemon.map(p => p.name));
    } catch (error) {
      console.error('Error fetching pokemon list from database:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchPokemonList();
  }, [fetchPokemonList]);
  
  return { pokemonList, loading, refetch: fetchPokemonList };
};

// Хук для получения одного покемона из базы данных с мемоизацией
export const usePokemon = (name: string | null) => {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchPokemon = useCallback(async (pokemonName: string) => {
    setLoading(true);
    setError(null);
    try {
      // Сначала пытаемся найти в базе данных
      const dbPokemon = await DatabaseService.searchPokemonInDatabase(pokemonName);
      const foundPokemon = dbPokemon.find(p => p.name.toLowerCase() === pokemonName.toLowerCase());
      
      if (foundPokemon) {
        setPokemon(convertDatabasePokemonToPokemon(foundPokemon));
      } else {
        throw new Error('Pokemon not found in database');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPokemon(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (!name) {
      setPokemon(null);
      return;
    }
    
    fetchPokemon(name);
  }, [name, fetchPokemon]);
  
  return { pokemon, loading, error };
};

// Хук для поиска покемонов в базе данных с fuzzy matching и оптимизацией
export const useSearchPokemon = (query: string) => {
  const [results, setResults] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const { pokemonList, loading: listLoading } = usePokemonList();
  
  // Мемоизируем Fuse.js инстанс
  const fuse = useMemo(() => {
    if (pokemonList.length === 0) return null;
    
    return new Fuse(pokemonList, {
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
      includeScore: true,
      keys: ['']
    });
  }, [pokemonList]);
  
  const searchPokemon = useCallback(async (searchQuery: string) => {
    if (!fuse || listLoading) return;
    
    setLoading(true);
    
    try {
      // Fuzzy search по именам из базы данных
      const fuzzyResults = fuse.search(searchQuery.toLowerCase());
      const matchedNames = fuzzyResults
        .slice(0, 12)
        .map(result => result.item);
      
      if (matchedNames.length > 0) {
        // Получаем детальную информацию из базы данных
        const dbPokemon = await DatabaseService.searchPokemonInDatabase(searchQuery);
        const filteredPokemon = dbPokemon.filter(p => 
          matchedNames.includes(p.name) && !(p as any).is_hidden // Исключаем скрытых покемонов
        );
        
        const convertedPokemon = filteredPokemon.map(convertDatabasePokemonToPokemon);
        setResults(convertedPokemon);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching pokemon in database:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [fuse, listLoading]);
  
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const debounceTimer = setTimeout(() => {
      searchPokemon(query);
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [query, searchPokemon]);
  
  return { results, loading };
};

// Хук для предложений поиска с мемоизацией
export const useSearchSuggestions = (query: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { pokemonList, loading } = usePokemonList();
  
  // Мемоизируем Fuse.js инстанс для предложений
  const suggestionsFuse = useMemo(() => {
    if (pokemonList.length === 0) return null;
    
    return new Fuse(pokemonList, {
      threshold: 0.3,
      distance: 50,
      minMatchCharLength: 1,
      keys: ['']
    });
  }, [pokemonList]);
  
  useEffect(() => {
    if (!query.trim() || !suggestionsFuse || loading) {
      setSuggestions([]);
      return;
    }
    
    const fuzzyResults = suggestionsFuse.search(query.toLowerCase());
    const matchedNames = fuzzyResults
      .slice(0, 8)
      .map(result => result.item);
    
    setSuggestions(matchedNames);
  }, [query, suggestionsFuse, loading]);
  
  return suggestions;
};