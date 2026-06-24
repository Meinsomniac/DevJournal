import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { AlertTriangle } from 'lucide-react-native';

const AnimatedPressable = ReAnimated.createAnimatedComponent(Pressable);

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.8, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <AnimatedPressable style={[styles.dialog, { backgroundColor: colors.bgCard }, animatedStyle]} onPress={e => e.stopPropagation()}>
          <View style={[styles.iconCircle, { backgroundColor: destructive ? colors.error + '20' : colors.brandPrimary + '20' }]}>
            <AlertTriangle size={28} color={destructive ? colors.error : colors.brandPrimary} />
          </View>

          <Text style={[Typography.headlineSmall, { color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.md }]}>
            {title}
          </Text>

          <Text style={[Typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            {message}
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, { borderColor: colors.borderMedium, borderWidth: 1 }]}>
              <Text style={[Typography.labelMedium, { color: colors.textSecondary }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.button, { backgroundColor: destructive ? colors.error : colors.brandPrimary }]}
            >
              <Text style={[Typography.labelMedium, { color: colors.textInverse }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: '85%',
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
});
