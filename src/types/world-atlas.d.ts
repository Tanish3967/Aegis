declare module 'world-atlas/countries-110m.json' {
  import type { Topology, GeometryCollection } from 'topojson-specification';

  interface CountryProps {
    name: string;
  }

  const topology: Topology<{
    countries: GeometryCollection<CountryProps>;
    land: GeometryCollection<Record<string, never>>;
  }>;

  export default topology;
}
