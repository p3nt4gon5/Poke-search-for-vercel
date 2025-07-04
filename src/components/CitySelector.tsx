import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, Navigation, Globe } from 'lucide-react';

interface City {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

interface CitySelectorProps {
  value: string;
  onCitySelect: (city: string, lat: number, lng: number) => void;
  onGetCurrentLocation?: () => void;
  error?: string;
  placeholder?: string;
}

const CitySelector: React.FC<CitySelectorProps> = ({
  value,
  onCitySelect,
  onGetCurrentLocation,
  error,
  placeholder = "Search for a city..."
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Update query when value prop changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search function
  const searchCities = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      // Using Nominatim API (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=8&addressdetails=1&featuretype=city`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }
      
      const data: City[] = await response.json();
      
      // Filter and format results to show only cities/towns
      const filteredCities = data.filter(item => 
        item.address && (
          item.address.city || 
          item.address.town || 
          item.address.village
        )
      );
      
      setSuggestions(filteredCities);
      setShowSuggestions(filteredCities.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Error searching cities:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchCities(newQuery);
    }, 300);
  };

  // Handle city selection
  const handleCitySelect = (city: City) => {
    const cityName = city.address?.city || city.address?.town || city.address?.village || city.display_name;
    const lat = parseFloat(city.lat);
    const lng = parseFloat(city.lon);
    
    setQuery(cityName);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    
    onCitySelect(cityName, lat, lng);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleCitySelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay hiding suggestions to allow clicking
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  // Format city display name
  const formatCityName = (city: City) => {
    const cityName = city.address?.city || city.address?.town || city.address?.village;
    const country = city.address?.country;
    
    if (cityName && country) {
      return `${cityName}, ${country}`;
    }
    
    return city.display_name;
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          <MapPin className="text-gray-400" size={20} />
          {loading && <Loader2 className="animate-spin text-gray-400" size={16} />}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder={placeholder}
          autoComplete="off"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {onGetCurrentLocation && (
            <button
              type="button"
              onClick={onGetCurrentLocation}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="Use current location"
            >
              <Navigation size={16} />
            </button>
          )}
          <Search className="text-gray-400" size={16} />
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
        >
          {suggestions.map((city, index) => (
            <button
              key={city.place_id}
              type="button"
              onClick={() => handleCitySelect(city)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <MapPin className="mr-3 text-gray-400" size={16} />
                <div>
                  <div className="font-medium">{formatCityName(city)}</div>
                  {city.address?.country && (
                    <div className="text-sm text-gray-500 flex items-center mt-1">
                      <Globe size={12} className="mr-1" />
                      {city.address.country}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !loading && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500">
          <MapPin className="mx-auto mb-2 text-gray-300" size={24} />
          <p>No cities found for "{query}"</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
};

export default CitySelector;