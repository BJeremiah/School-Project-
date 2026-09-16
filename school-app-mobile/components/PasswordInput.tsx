// components/PasswordInput.tsx
// Drop-in replacement for a password <TextInput>: same props/appearance, plus an
// eye icon to toggle showing the typed password. Renders as an invisible full-width
// wrapper around the TextInput (which keeps its own box styling unchanged) with the
// icon absolutely positioned over its right edge.

import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordInput({ style, containerStyle, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[{ alignSelf: 'stretch', justifyContent: 'center' }, containerStyle]}>
      <TextInput {...rest} style={[style, { paddingRight: 44 }]} secureTextEntry={!visible} />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.charcoalMuted} />
      </Pressable>
    </View>
  );
}
