import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Service } from '@/data/mockServices';
import { ThemedText } from '@/components/ThemedText';

interface ServiceListItemProps {
  service: Service;
  onPress?: () => void;
}

const ServiceListItem: React.FC<ServiceListItemProps> = ({ service, onPress }) => {
  return (
    <Link href={`/service/${service.id}`} asChild>
      <TouchableOpacity style={styles.container} onPress={onPress}>
        <View style={styles.content}>
          <ThemedText style={styles.name}>{service.name}</ThemedText>
          <ThemedText style={styles.category}>{service.category}</ThemedText>
          <ThemedText style={styles.description} numberOfLines={2}>
            {service.shortDescription}
          </ThemedText>
          
          {service.averageRating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#f8b500" />
              <ThemedText style={styles.rating}>
                {service.averageRating.toFixed(1)}
              </ThemedText>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>
    </Link>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'white',
    // Add shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Add elevation for Android
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    color: '#f8b500',
    fontWeight: 'bold',
  },
});

export default ServiceListItem;
