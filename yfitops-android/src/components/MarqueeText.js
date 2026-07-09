// src/components/MarqueeText.js
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';

export default function MarqueeText({ text, style, containerStyle, speed = 40 }) {
  const anim                                = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth]           = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animRef                             = useRef(null);

  const overflow = textWidth > 0 && containerWidth > 0
    ? Math.max(0, textWidth - containerWidth)
    : 0;

  useEffect(() => {
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }
    anim.setValue(0);
    if (overflow <= 0) return;

    const duration = (overflow / speed) * 1000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(anim, { toValue: -overflow, duration, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    animRef.current = loop;
    loop.start();
    return () => { loop.stop(); };
  }, [overflow, text]);

  return (
    <View
      style={[{ overflow: 'hidden' }, containerStyle]}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/*
        width:9999 evita que RN limite el ancho del fantasma al contenedor.
        onLayout reporta el ancho natural real del texto en una línea.
      */}
      <Text
        numberOfLines={1}
        style={[style, { position: 'absolute', opacity: 0, width: 9999 }]}
        onLayout={e => setTextWidth(e.nativeEvent.layout.width)}
      >
        {text}
      </Text>

      <Animated.Text
        numberOfLines={1}
        style={[style, { transform: [{ translateX: anim }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}