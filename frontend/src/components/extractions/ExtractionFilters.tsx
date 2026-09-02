import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ExtractionFilters as FiltersType } from '../../services/extraction.service';
import { Typography } from '../ui/Typography';
import { theme } from '../../theme';

interface ExtractionFiltersProps {
  filters: FiltersType;
  onChange: (filters: FiltersType) => void;
}

const EXTRACTION_TYPES = [
  { id: '', label: 'All' },
  { id: 'life_event', label: 'Life Events' },
  { id: 'task', label: 'Tasks' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'quote', label: 'Quotes' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'lead', label: 'Leads' },
  { id: 'gift_hint', label: 'Gift Hints' },
  { id: 'location_hint', label: 'Locations' }
];

const STATUS_FILTERS = [
  { id: '', label: 'All Status' },
  { id: 'active', label: 'Active' },
  { id: 'needs_review', label: 'Needs Review' }
];

export const ExtractionFilters: React.FC<ExtractionFiltersProps> = ({ filters, onChange }) => {
  const handleTypeSelect = (typeId: string) => {
    onChange({ ...filters, type: typeId || undefined });
  };

  const handleStatusSelect = (statusId: string) => {
    onChange({ ...filters, status: statusId || undefined });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow} contentContainerStyle={styles.scrollContent}>
        {EXTRACTION_TYPES.map(type => {
          const isActive = (filters.type || '') === type.id;
          return (
            <TouchableOpacity 
              key={`type-${type.id}`} 
              style={[styles.filterChip, isActive && styles.activeChip]}
              onPress={() => handleTypeSelect(type.id)}
            >
              <Typography variant="bodyMedium" color={isActive ? theme.colors.textInverse : theme.colors.textSecondary}>
                {type.label}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow} contentContainerStyle={styles.scrollContent}>
        {STATUS_FILTERS.map(status => {
          const isActive = (filters.status || '') === status.id;
          return (
            <TouchableOpacity 
              key={`status-${status.id}`} 
              style={[styles.filterChip, isActive && styles.activeChip]}
              onPress={() => handleStatusSelect(status.id)}
            >
              <Typography variant="bodyMedium" color={isActive ? theme.colors.textInverse : theme.colors.textSecondary}>
                {status.label}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md
  },
  scrollRow: {
    marginBottom: theme.spacing.sm
  },
  scrollContent: {
    paddingRight: theme.spacing.md,
    gap: theme.spacing.sm
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activeChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  }
});
