import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text, Image, StatusBar, Easing } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation values
  const mainFade = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(0.4)).current;
  const orbTranslateY = useRef(new Animated.Value(0)).current;
  
  // Wave rings
  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring1Opacity = useRef(new Animated.Value(0.7)).current;
  const ring2Scale = useRef(new Animated.Value(0.8)).current;
  const ring2Opacity = useRef(new Animated.Value(0.7)).current;
  
  // Text & badge stagger
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const subTranslateY = useRef(new Animated.Value(15)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  // Exit transition
  const exitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Core Entrance: Fade in screen & Spring bounce the 3D Orb
    Animated.parallel([
      Animated.timing(mainFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(orbScale, {
        toValue: 1,
        friction: 5.5,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous Wave Ring 1 Loop
    Animated.loop(
      Animated.parallel([
        Animated.timing(ring1Scale, {
          toValue: 1.85,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ring1Opacity, {
          toValue: 0,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Continuous Wave Ring 2 Loop (offset)
    const ring2Timer = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 2.1,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 450);

    // 4. Subtle Orb Floating Hover
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbTranslateY, {
          toValue: -6,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbTranslateY, {
          toValue: 4,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 5. Staggered Typography Entrance
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    // 6. Smooth Cinematic Exit
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(mainFade, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, 2100);

    return () => {
      clearTimeout(ring2Timer);
      clearTimeout(exitTimer);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: mainFade, transform: [{ scale: exitScale }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      {/* Ambient background aura */}
      <View style={styles.ambientAura} />

      {/* CENTER STAGE */}
      <View style={styles.centerStage}>
        {/* Radar Ring 1 */}
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
            },
          ]}
        />

        {/* Radar Ring 2 */}
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveRing2,
            {
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            },
          ]}
        />

        {/* Floating 3D Glowing Core */}
        <Animated.View
          style={[
            styles.orbWrapper,
            {
              transform: [
                { scale: orbScale },
                { translateY: orbTranslateY }
              ],
            },
          ]}
        >
          <Image
            source={require('../assets/nryn_ai_logo.jpg')}
            style={styles.orbImage}
            resizeMode="cover"
          />
          <View style={styles.glassReflectionRing} />
        </Animated.View>

        {/* Staggered Brand Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>N R Y N</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.subContainer,
            {
              opacity: subOpacity,
              transform: [{ translateY: subTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTagline}>Personal AI WhatsApp Companion</Text>
        </Animated.View>

        {/* Live Status Pill */}
        <Animated.View style={[styles.statusPill, { opacity: badgeOpacity }]}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusPillText}>Neural Engine Ready</Text>
        </Animated.View>
      </View>

      {/* BOTTOM FOOTER BRANDING */}
      <Animated.View style={[styles.bottomBar, { opacity: subOpacity }]}>
        <Text style={styles.bottomBarText}>End-to-End Encrypted • Real-Time AI</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientAura: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  waveRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.6)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  waveRing2: {
    borderColor: 'rgba(129, 140, 248, 0.45)',
  },
  orbWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.75,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.8)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  orbImage: {
    width: '100%',
    height: '100%',
  },
  glassReflectionRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 12,
    textAlign: 'center',
  },
  subContainer: {
    alignItems: 'center',
    marginTop: 6,
  },
  brandTagline: {
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 0.6,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginTop: 20,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    color: '#E0E7FF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 36,
  },
  bottomBarText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});
