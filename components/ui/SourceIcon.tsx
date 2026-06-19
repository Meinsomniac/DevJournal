import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Typography } from '@/constants/Typography';

interface SourceIconProps {
  iconUri?: string;
  name: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
}

export function SourceIcon({
  iconUri,
  name,
  size = 40,
  backgroundColor = '#E0E7FF',
  color = '#4F46E5',
}: SourceIconProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = iconUri && !imgError;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: showImage ? 'transparent' : backgroundColor,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: iconUri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size * 0.25,
            },
          ]}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <Text
          style={[
            styles.letter,
            {
              color,
              fontSize: size * 0.45,
            },
          ]}
        >
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    // no extra styles needed; sizing is inline
  },
  letter: {
    ...Typography.labelLarge,
    fontWeight: '700',
  },
});
