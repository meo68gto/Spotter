import 'react-native-reanimated';
import 'react-native-svg';
import 'react-native-webview';

// TypeScript 5.7+ compatibility fix for react-native-reanimated
// The issue is that ComponentClass from @types/react is more strict in TS 5.7+
declare module 'react-native-reanimated' {
  import { View, Text, ScrollView, Image, FlatList } from 'react-native';
  import * as React from 'react';
  
  // Re-export Animated components as functional components
  export const View: React.FC<React.ComponentProps<typeof View>>;
  export const Text: React.FC<React.ComponentProps<typeof Text>>;
  export const ScrollView: React.FC<React.ComponentProps<typeof ScrollView>>;
  export const Image: React.FC<React.ComponentProps<typeof Image>>;
}

// TypeScript 5.7+ compatibility fix for react-native-svg
declare module 'react-native-svg' {
  import * as React from 'react';
  
  export const Svg: React.FC<any>;
  export const Circle: React.FC<any>;
  export const Polygon: React.FC<any>;
  export const Text: React.FC<any>;
}

// TypeScript 5.7+ compatibility fix for react-native-webview
declare module 'react-native-webview' {
  import * as React from 'react';
  
  export const WebView: React.FC<any>;
}
