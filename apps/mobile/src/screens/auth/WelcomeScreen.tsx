import { useMemo, useState } from 'react';
import { Dimensions, ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { stockPhotos } from '../../lib/stockPhotos';
import { useTheme } from '../../theme/provider';

const { width } = Dimensions.get('window');

type Panel = {
  title: string;
  body: string;
  image: string;
};

export function WelcomeScreen({
  onLogin,
  onSignUp,
  onDemoMode,
  onGuestBrowse
}: {
  onLogin: () => void;
  onSignUp: () => void;
  onDemoMode?: () => void;
  onGuestBrowse?: () => void;
}) {
  const { tokens } = useTheme();
  const [index, setIndex] = useState(0);

  const panels = useMemo<Panel[]>(
    () => [
      {
        title: 'Find your next game nearby',
        body: 'Discover athletes and coaches who match your level and your weekly schedule.',
        image: stockPhotos.welcomePanelOne
      },
      {
        title: 'Keep your progress visible',
        body: 'Track sessions, feedback, and match quality in one consistent profile.',
        image: stockPhotos.welcomePanelTwo
      },
      {
        title: 'Book golf coaching when it matters',
        body: 'Move from quick answers to live sessions with expert golf coaches.',
        image: stockPhotos.welcomePanelThree
      }
    ],
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}> 
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setIndex(next);
        }}
      >
        {panels.map((panel) => (
          <ImageBackground key={panel.title} source={{ uri: panel.image }} style={styles.panel} imageStyle={styles.panelImage}>
            <View style={styles.panelOverlay}>
              {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
              <Animated.View entering={FadeIn.duration(280)} style={styles.copyWrap}>
                <Text style={styles.panelTitle}>{panel.title}</Text>
                <Text style={styles.panelBody}>{panel.body}</Text>
              </Animated.View>
            </View>
          </ImageBackground>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <View style={styles.dots}>
          {panels.map((panel, i) => (
            <View
              key={panel.title}
              style={[
                styles.dot,
                { backgroundColor: i === index ? tokens.primary : tokens.borderStrong }
              ]}
            />
          ))}
        </View>
        <Button title="Log In" onPress={onLogin} />
        <Button title="Create Account" onPress={onSignUp} tone="secondary" />
        {onGuestBrowse ? <Button title="Browse as Guest" onPress={onGuestBrowse} tone="ghost" /> : null}
        {onDemoMode ? <Button title="Explore Demo Mode" onPress={onDemoMode} tone="ghost" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  panel: {
    width,
    flex: 1,
    justifyContent: 'flex-end'
  },
  panelImage: {
    resizeMode: 'cover'
  },
  panelOverlay: {
    minHeight: 280,
    justifyContent: 'flex-end',
    padding: 24,
    backgroundColor: 'rgba(7, 17, 24, 0.36)'
  },
  copyWrap: {
    gap: 10
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37
  },
  panelBody: {
    color: '#f0f6fb',
    fontSize: 16,
    lineHeight: 22
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8
  }
});
