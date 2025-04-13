import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Linking, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { mockServices, Service, Review } from '@/data/mockServices';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [userReview, setUserReview] = useState<string>('');

  useEffect(() => {
    // In a real app, this would fetch from Supabase
    const foundService = mockServices.find(s => s.id === id);
    setService(foundService || null);
  }, [id]);

  const handleOpenMaps = () => {
    if (!service) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const { latitude, longitude, address, name } = service;
    const encodedAddress = encodeURIComponent(address);
    const encodedName = encodeURIComponent(name);
    
    let url: string;
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?q=${encodedName}&ll=${latitude},${longitude}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodedName}`;
    }
    
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
        }
      })
      .catch(err => console.error('An error occurred', err));
  };

  const handleOpenGoogleMaps = () => {
    if (!service) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const { latitude, longitude, name } = service;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(name)}`;
    
    Linking.openURL(url).catch(err => console.error('An error occurred', err));
  };

  const handleCall = () => {
    if (!service) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const phoneNumber = service.phone.replace(/\D/g, ''); // Remove non-numeric characters
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleOpenWebsite = () => {
    if (!service || !service.website) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Linking.openURL(service.website);
  };

  const handleSubmitReview = () => {
    if (!service || !userRating || !userReview) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Create a new review
    const newReview: Review = {
      id: `new-${Date.now()}`,
      serviceId: service.id,
      rating: userRating,
      comment: userReview,
      author: 'You',
      source: 'Blausm App',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    };
    
    // Add the review to the service
    const updatedService = { ...service };
    if (!updatedService.reviews) {
      updatedService.reviews = [];
    }
    updatedService.reviews.unshift(newReview);
    
    // Recalculate average rating
    const totalRatings = updatedService.reviews.reduce((sum, review) => sum + review.rating, 0);
    updatedService.averageRating = totalRatings / updatedService.reviews.length;
    
    // Update the service
    setService(updatedService);
    
    // Reset form
    setUserRating(0);
    setUserReview('');
  };

  const renderHours = () => {
    if (!service) return null;
    
    return Object.entries(service.hours).map(([day, hours]) => (
      <View key={day} style={styles.hoursRow}>
        <ThemedText style={styles.dayText}>{day}</ThemedText>
        <ThemedText style={styles.hoursText}>{hours}</ThemedText>
      </View>
    ));
  };

  const renderReviews = () => {
    if (!service || !service.reviews || service.reviews.length === 0) {
      return (
        <ThemedText style={styles.noReviewsText}>No reviews available</ThemedText>
      );
    }
    
    // Display up to 3 reviews
    const displayReviews = service.reviews.slice(0, 3);
    
    return displayReviews.map((review: Review) => (
      <View key={review.id} style={styles.reviewContainer}>
        <View style={styles.reviewHeader}>
          <ThemedText style={styles.reviewAuthor}>{review.author}</ThemedText>
          <View style={styles.ratingContainer}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < review.rating ? 'star' : 'star-outline'}
                size={16}
                color="#f8b500"
              />
            ))}
          </View>
        </View>
        <ThemedText style={styles.reviewSource}>via {review.source}</ThemedText>
        <ThemedText style={styles.reviewDate}>{review.date}</ThemedText>
        <ThemedText style={styles.reviewComment}>{review.comment}</ThemedText>
      </View>
    ));
  };

  if (!service) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>{service.name}</ThemedText>
        </View>
        
        <View style={styles.categoryContainer}>
          <ThemedText style={styles.category}>{service.category}</ThemedText>
        </View>
        
        {service.averageRating && (
          <View style={styles.ratingContainer}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < Math.round(service.averageRating || 0) ? 'star' : 'star-outline'}
                size={20}
                color="#f8b500"
              />
            ))}
            <ThemedText style={styles.ratingText}>
              {service.averageRating.toFixed(1)}
            </ThemedText>
          </View>
        )}
        
        <ThemedText style={styles.description}>{service.description}</ThemedText>
        
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Address</ThemedText>
          <ThemedText style={styles.address}>{service.address}</ThemedText>
          <View style={styles.mapButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenMaps}
            >
              <Ionicons name="map-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Apple Maps</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenGoogleMaps}
            >
              <Ionicons name="globe-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Google Maps</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
          <ThemedText style={styles.contactText}>{service.phone}</ThemedText>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCall}
          >
            <Ionicons name="call-outline" size={20} color="white" />
            <ThemedText style={styles.actionButtonText}>Call</ThemedText>
          </TouchableOpacity>
          
          {service.website && (
            <>
              <ThemedText style={styles.contactText}>{service.website}</ThemedText>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenWebsite}
              >
                <Ionicons name="globe-outline" size={20} color="white" />
                <ThemedText style={styles.actionButtonText}>Visit Website</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
        
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hours</ThemedText>
          <View style={styles.hoursContainer}>
            {renderHours()}
          </View>
        </View>
        
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Reviews</ThemedText>
          {renderReviews()}
          
          <View style={styles.addReviewContainer}>
            <ThemedText style={styles.addReviewTitle}>Add Your Review</ThemedText>
            
            <View style={styles.ratingInputContainer}>
              <ThemedText style={styles.ratingLabel}>Your Rating:</ThemedText>
              <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity 
                    key={star} 
                    onPress={() => setUserRating(star)}
                    style={styles.starButton}
                  >
                    <Ionicons 
                      name={userRating >= star ? "star" : "star-outline"} 
                      size={30} 
                      color="#f8b500" 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TextInput
              style={styles.reviewInput}
              placeholder="Write your review here..."
              multiline
              numberOfLines={4}
              value={userReview}
              onChangeText={setUserReview}
            />
            
            <TouchableOpacity 
              style={[
                styles.submitButton, 
                (!userRating || !userReview) && styles.disabledButton
              ]}
              disabled={!userRating || !userReview}
              onPress={handleSubmitReview}
            >
              <ThemedText style={styles.submitButtonText}>Submit Review</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  categoryContainer: {
    marginBottom: 12,
  },
  category: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8b500',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  address: {
    fontSize: 16,
    marginBottom: 12,
  },
  mapButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactText: {
    fontSize: 16,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1890ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  hoursContainer: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
  },
  hoursText: {
    fontSize: 16,
  },
  reviewContainer: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewSource: {
    fontSize: 14,
    color: '#666',
  },
  reviewDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 16,
    lineHeight: 22,
  },
  noReviewsText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#999',
  },
  addReviewContainer: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 16,
  },
  addReviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ratingInputContainer: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: 'row',
  },
  starButton: {
    marginRight: 8,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#1890ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
