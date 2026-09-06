import React, { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, fontSizes, radii, spacing, shadow } from '../theme/theme';

type Variant = 'primary' | 'success' | 'alert' | 'ghost';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantTints: Record<Variant, { base: string; blurTint: 'light' | 'dark' }> = {
  primary: { base: 'rgba(46,31,110,0.55)', blurTint: 'dark' },
  success: { base: 'rgba(58,166,85,0.55)', blurTint: 'dark' },
  alert: { base: 'rgba(255,90,95,0.55)', blurTint: 'dark' },
  ghost: { base: 'rgba(255,255,255,0.35)', blurTint: 'light' },
};

export default function GlassButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  fullWidth = true,
}: GlassButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const tint = variantTints[variant];
  const textColor = variant === 'ghost' ? colors.indigo : colors.white;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && { width: '100%' },
        shadow.glass,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.pressable, style]}
      >
        <BlurView intensity={40} tint={tint.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint.base }]} />
        {/* Glass highlight streak across the top */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.highlight}
        />
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    letterSpacing: 0.3,
  },
});