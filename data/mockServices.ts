export interface Review {
  id: string;
  serviceId: string;
  rating: number;
  comment: string;
  author: string;
  source: string;
  date: string;
  neurodivergent_mentions?: {
    keyword: string;
    context: string;
    sentiment: string;
    sentiment_score: number;
  }[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  website?: string;
  hours: {
    [key: string]: string;
  };
  averageRating?: number;
  reviews?: Review[];
  neurodivergent_mentions?: {
    keyword: string;
    context: string;
    source: string;
    sentiment: string;
    sentiment_score: number;
  }[];
}

export const mockServices: Service[] = [
  {
    "id": "1",
    "name": "Spectrum Dental Care",
    "description": "A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.",
    "shortDescription": "Dental practice specializing in care for neurodivergent patients with sensory accommodations.",
    "category": "Dentist",
    "address": "456 Park Avenue, New York, NY 10022",
    "latitude": 40.758,
    "longitude": -73.9855,
    "phone": "(212) 555-5678",
    "website": "https://spectrumdentalcare.com",
    "hours": {
      "Monday": "8:00 AM - 5:00 PM",
      "Tuesday": "8:00 AM - 5:00 PM",
      "Wednesday": "8:00 AM - 5:00 PM",
      "Thursday": "8:00 AM - 5:00 PM",
      "Friday": "8:00 AM - 3:00 PM",
      "Saturday": "Closed",
      "Sunday": "Closed"
    },
    "averageRating": 4.9,
    "reviews": [
      {
        "id": "1-1",
        "serviceId": "1",
        "rating": 5,
        "comment": "Dr. Johnson is amazing with my daughter who has autism. They take the time to explain everything and let her get comfortable with the tools before using them.",
        "author": "Rebecca W.",
        "source": "Google Maps",
        "date": "2025-03-20",
        "neurodivergent_mentions": [
          {
            "keyword": "autism",
            "context": "Dr. Johnson is amazing with my daughter who has autism. They take the time to explain everything and let her get comfortable with the tools before using them.",
            "sentiment": "Positive",
            "sentiment_score": 0.8
          }
        ]
      },
      {
        "id": "1-2",
        "serviceId": "1",
        "rating": 5,
        "comment": "As someone with severe dental anxiety and ADHD, I've avoided dentists for years. This practice has changed everything for me. Highly recommend!",
        "author": "David K.",
        "source": "Google Maps",
        "date": "2025-02-10",
        "neurodivergent_mentions": [
          {
            "keyword": "ADHD",
            "context": "As someone with severe dental anxiety and ADHD, I've avoided dentists for years. This practice has changed everything for me.",
            "sentiment": "Positive",
            "sentiment_score": 0.6
          },
          {
            "keyword": "anxiety",
            "context": "As someone with severe dental anxiety and ADHD, I've avoided dentists for years. This practice has changed everything for me.",
            "sentiment": "Positive",
            "sentiment_score": 0.6
          }
        ]
      }
    ],
    "neurodivergent_mentions": [
      {
        "keyword": "autism",
        "context": "A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.",
        "source": "Description",
        "sentiment": "Positive",
        "sentiment_score": 0.7
      },
      {
        "keyword": "ADHD",
        "context": "A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.",
        "source": "Description",
        "sentiment": "Positive",
        "sentiment_score": 0.7
      },
      {
        "keyword": "anxiety",
        "context": "A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort. Our dentists and hygienists are trained in working with patients who have autism, ADHD, anxiety disorders, and other neurodivergent conditions.",
        "source": "Description",
        "sentiment": "Positive",
        "sentiment_score": 0.7
      },
      {
        "keyword": "neurodivergent",
        "context": "A dental practice specializing in care for neurodivergent patients. We offer sensory-friendly environments, visual schedules, and extra appointment time to ensure comfort.",
        "source": "Description",
        "sentiment": "Positive",
        "sentiment_score": 0.7
      }
    ]
  }
];
