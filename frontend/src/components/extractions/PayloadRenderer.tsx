import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from '../ui/Typography';
import { theme } from '../../theme';

interface PayloadRendererProps {
  payload: Record<string, any>;
  isDetailView?: boolean;
}

const getBirthdaySummary = (payload: Record<string, any>) => {
  if (payload.event?.toLowerCase() !== 'birthday' || !payload.date) return null;

  const birthday = new Date(`${payload.date}T00:00:00`);
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const name = String(payload.description || '').replace(/\s+birthday.*$/i, '').trim();
  if (!name) return null;

  const when = birthday.getTime() === tomorrow.getTime()
    ? 'Tomorrow'
    : birthday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${when} is ${name}'s birthday`;
};

export const PayloadRenderer: React.FC<PayloadRendererProps> = ({ payload, isDetailView = false }) => {
  if (!payload || Object.keys(payload).length === 0) return null;

  const birthdaySummary = !isDetailView ? getBirthdaySummary(payload) : null;
  if (birthdaySummary) {
    return (
      <View style={styles.container}>
        <Typography variant="bodyMedium">{birthdaySummary}</Typography>
      </View>
    );
  }

  const renderField = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Format label (e.g. due_date -> Due Date)
    const label = key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    return (
      <View key={key} style={isDetailView ? styles.detailField : styles.cardField}>
        {isDetailView && (
          <Typography variant="caption" color={theme.colors.textSecondary} style={styles.label}>
            {label}:
          </Typography>
        )}
        {!isDetailView && (key === 'description' || key === 'title' || key === 'event' || key === 'item') ? (
           <Typography variant="bodyMedium" numberOfLines={2}>{stringValue}</Typography>
        ) : (
           <Typography 
             variant={isDetailView ? 'body' : 'body'} 
             color={isDetailView ? theme.colors.textPrimary : theme.colors.textSecondary}
           >
             {!isDetailView ? `${label}: ` : ''}{stringValue}
           </Typography>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {Object.entries(payload).map(([key, value]) => renderField(key, value))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.xs
  },
  cardField: {
    marginBottom: theme.spacing.xs
  },
  detailField: {
    marginBottom: theme.spacing.md
  },
  label: {
    marginBottom: theme.spacing.xs,
  }
});
