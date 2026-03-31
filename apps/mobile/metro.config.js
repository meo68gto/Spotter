const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname; // apps/mobile
// monorepo root = Spotter repo root (parent of apps/mobile)
const monorepoRoot = path.resolve(projectRoot, '../../');

const config = getDefaultConfig(projectRoot);

// Metro can't follow TypeScript "exports" field subpaths when a monorepo workspace
// package has its source in packages/* (not node_modules).
// Point Metro directly at the source files via extraNodeModules.
config.resolver.extraNodeModules = {
  '@spotter/supabase': path.join(monorepoRoot, 'packages', 'supabase', 'src'),
  '@spotter/types': path.join(monorepoRoot, 'packages', 'types', 'src'),
  '@spotter/env': path.join(monorepoRoot, 'packages', 'env', 'src'),
};

module.exports = config;
