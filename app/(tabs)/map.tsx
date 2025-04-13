import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, FlatList, Dimensions, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { mockServices } from '@/data/mockServices';
import { Service } from '@/data/mockServices';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import ServiceListItem from '@/components/ServiceListItem';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function Map() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const mapRef = useRef<MapView>(null);
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Map' | 'List'>('Map');
  const [services, setServices] = useState<Service[]>(mockServices || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>(services);
  const [zoomLevel, setZoomLevel] = useState<number>(14); // Default zoom level
  const router = useRouter();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  useEffect(() => {
    // Filter services based on search query
    if (searchQuery) {
      const filtered = services.filter(service => 
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  }, [services, searchQuery]);

  const handleTabPress = (tab: 'Map' | 'List') => {
    setActiveTab(tab);
  };

  const zoomIn = () => {
    mapRef.current?.animateToRegion({
      latitude: location?.coords.latitude || 40.758,
      longitude: location?.coords.longitude || -73.9855,
      latitudeDelta: LATITUDE_DELTA / 2,
      longitudeDelta: LONGITUDE_DELTA / 2,
    }, 300);
  };

  const zoomOut = () => {
    mapRef.current?.animateToRegion({
      latitude: location?.coords.latitude || 40.758,
      longitude: location?.coords.longitude || -73.9855,
      latitudeDelta: LATITUDE_DELTA * 2,
      longitudeDelta: LONGITUDE_DELTA * 2,
    }, 300);
  };

  const goToCurrentLocation = () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: LATITUDE_DELTA / 2,
        longitudeDelta: LONGITUDE_DELTA / 2,
      }, 1000);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Find Services</ThemedText>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
        <Ionicons name="search" size={20} color={isDarkMode ? "#999" : "#666"} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search services by name or category"
          placeholderTextColor={isDarkMode ? "#999" : "#666"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, isDarkMode && styles.tabContainerDark]}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'Map' && (isDarkMode ? styles.activeTabDark : styles.activeTab)
          ]} 
          onPress={() => handleTabPress('Map')}
        >
          <Ionicons 
            name="map" 
            size={20} 
            color={activeTab === 'Map' 
              ? '#1890ff' 
              : isDarkMode ? '#ccc' : '#666'
            } 
          />
          <ThemedText style={[
            styles.tabText, 
            isDarkMode && styles.tabTextDark,
            activeTab === 'Map' && styles.activeTabText
          ]}>
            Map View
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'List' && (isDarkMode ? styles.activeTabDark : styles.activeTab)
          ]} 
          onPress={() => handleTabPress('List')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={activeTab === 'List' 
              ? '#1890ff' 
              : isDarkMode ? '#ccc' : '#666'
            } 
          />
          <ThemedText style={[
            styles.tabText, 
            isDarkMode && styles.tabTextDark,
            activeTab === 'List' && styles.activeTabText
          ]}>
            List View
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'Map' ? (
        <View style={styles.mapContainer}>
          {errorMsg ? (
            <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: location?.coords.latitude || 40.758,
                  longitude: location?.coords.longitude || -73.9855,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={true}
                showsScale={true}
                userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
              >
                {filteredServices.map((service) => (
                  <Marker
                    key={service.id}
                    coordinate={{
                      latitude: service.latitude,
                      longitude: service.longitude,
                    }}
                    title={service.name}
                    description={service.shortDescription}
                    onCalloutPress={() => router.push(`/service/${service.id}`)}
                  />
                ))}
              </MapView>
              
              {/* Map controls */}
              <View style={[styles.mapControls, isDarkMode && styles.mapControlsDark]}>
                <TouchableOpacity 
                  style={[styles.mapControlButton, isDarkMode && styles.mapControlButtonDark]}
                  onPress={zoomIn}
                >
                  <Ionicons name="add" size={24} color={isDarkMode ? "#fff" : "#333"} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.mapControlButton, isDarkMode && styles.mapControlButtonDark]}
                  onPress={zoomOut}
                >
                  <Ionicons name="remove" size={24} color={isDarkMode ? "#fff" : "#333"} />
                </TouchableOpacity>
              </View>
              
              {/* Current location button */}
              <TouchableOpacity 
                style={[styles.currentLocationButton, isDarkMode && styles.currentLocationButtonDark]}
                onPress={goToCurrentLocation}
              >
                <Ionicons name="locate" size={24} color={isDarkMode ? "#fff" : "#333"} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ServiceListItem
              service={item}
              onPress={() => {
                router.push(`/service/${item.id}`);
              }}
            />
          )}
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No services found</ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  searchContainerDark: {
    backgroundColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  tabContainerDark: {
    backgroundColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    backgroundColor: '#e6f7ff',
  },
  activeTabDark: {
    backgroundColor: '#1f3a54', // Darker blue for dark mode
  },
  tabText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#333', // Darker color for better contrast when inactive
  },
  tabTextDark: {
    color: '#ccc', // Lighter color for dark mode
  },
  activeTabText: {
    color: '#1890ff',
    fontWeight: '700', // Bolder when active
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  errorText: {
    padding: 20,
    textAlign: 'center',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mapControlsDark: {
    backgroundColor: '#333',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  mapControlButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapControlButtonDark: {
    backgroundColor: '#333',
    borderBottomColor: '#444',
  },
  currentLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  currentLocationButtonDark: {
    backgroundColor: '#333',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
