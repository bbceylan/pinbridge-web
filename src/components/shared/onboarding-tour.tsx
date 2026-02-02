'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  CheckCircle,
  Zap,
  Search,
  Eye,
  ExternalLink,
  Clock,
  Shield
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  targetElement?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  tourType: 'automated-transfer' | 'verification' | 'general';
}

const AUTOMATED_TRANSFER_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Automated Transfer!',
    description: 'Let us show you how to transfer your places automatically with intelligent matching.',
    content: (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Zap className="h-8 w-8 text-blue-600" />
          <div>
            <h3 className="font-semibold text-lg">Smart & Fast</h3>
            <p className="text-gray-600">Automatically find and match your places in Apple Maps or Google Maps</p>
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>What's different:</strong> Instead of manually searching for each place, 
            our system does the work for you and only asks for verification when needed.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'how-it-works',
    title: 'How Automated Transfer Works',
    description: 'Understanding the three-step process',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
            <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <h4 className="font-medium text-green-900">Automatic Processing</h4>
              <p className="text-sm text-green-700">We search for each place in your target service and find the best matches</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
            <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <h4 className="font-medium text-yellow-900">Smart Verification</h4>
              <p className="text-sm text-yellow-700">Review matches with confidence scores - accept high-confidence matches in bulk</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
            <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <h4 className="font-medium text-blue-900">Batch Transfer</h4>
              <p className="text-sm text-blue-700">Open all verified places in your target app with one click</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'confidence-scores',
    title: 'Understanding Confidence Scores',
    description: 'How we determine match quality',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">Our AI analyzes multiple factors to score each match:</p>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Badge className="bg-green-100 text-green-800 border-green-300">High (90-100%)</Badge>
            <span className="text-sm">Very likely correct - safe to accept automatically</span>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium (70-89%)</Badge>
            <span className="text-sm">Probably correct - worth a quick review</span>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className="bg-red-100 text-red-800 border-red-300">Low (&lt;70%)</Badge>
            <span className="text-sm">Uncertain match - needs manual verification</span>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Matching factors:</strong> Name similarity, address matching, geographic distance, and place category
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'bulk-actions',
    title: 'Efficient Bulk Actions',
    description: 'Save time with smart bulk operations',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">Speed up verification with these bulk actions:</p>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Accept All High Confidence</h4>
              <p className="text-sm text-gray-600">Automatically accept matches with 90%+ confidence</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Eye className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Filter by Confidence</h4>
              <p className="text-sm text-gray-600">Focus on medium or low confidence matches that need attention</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Search className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Manual Search</h4>
              <p className="text-sm text-gray-600">Search manually for places that couldn't be matched automatically</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'tips',
    title: 'Pro Tips for Best Results',
    description: 'Get the most out of automated transfer',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Processing Time</h4>
              <p className="text-sm text-gray-600">Large collections (100+ places) may take 2-5 minutes to process</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Data Privacy</h4>
              <p className="text-sm text-gray-600">We only send necessary data to mapping services and cache results locally</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <ExternalLink className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium">Final Transfer</h4>
              <p className="text-sm text-gray-600">Places open in batches of 5 to avoid overwhelming your browser</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Remember:</strong> You can always pause processing and resume later, or fall back to manual transfer mode.
          </p>
        </div>
      </div>
    )
  }
];

const VERIFICATION_STEPS: OnboardingStep[] = [
  {
    id: 'verification-overview',
    title: 'Verification Interface Guide',
    description: 'Learn how to efficiently review and verify matches',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">The verification interface helps you quickly review automatic matches:</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Left Side: Original Place</h4>
            <p className="text-sm text-gray-600">Your place from PinBridge with name, address, and location</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Right Side: Matched Place</h4>
            <p className="text-sm text-gray-600">The found match with confidence score and details</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'verification-actions',
    title: 'Verification Actions',
    description: 'What you can do with each match',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-2 bg-green-50 rounded">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm"><strong>Accept:</strong> Confirm this match is correct</span>
          </div>
          <div className="flex items-center space-x-3 p-2 bg-red-50 rounded">
            <X className="h-4 w-4 text-red-600" />
            <span className="text-sm"><strong>Reject:</strong> This match is incorrect</span>
          </div>
          <div className="flex items-center space-x-3 p-2 bg-blue-50 rounded">
            <Search className="h-4 w-4 text-blue-600" />
            <span className="text-sm"><strong>Manual Search:</strong> Find the correct place yourself</span>
          </div>
        </div>
      </div>
    )
  }
];

export function OnboardingTour({ 
  isOpen, 
  onClose, 
  onComplete, 
  tourType 
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const steps = tourType === 'automated-transfer' ? AUTOMATED_TRANSFER_STEPS :
                tourType === 'verification' ? VERIFICATION_STEPS :
                AUTOMATED_TRANSFER_STEPS; // Default to automated transfer

  useEffect(() => {
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      setCurrentStep(0);
    }
  }, [isOpen, hasStarted]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
    setHasStarted(false);
    setCurrentStep(0);
  };

  const handleSkip = () => {
    onClose();
    setHasStarted(false);
    setCurrentStep(0);
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleSkip}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <span>{step.title}</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {currentStep + 1} of {steps.length}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step.content}
        </div>

        {/* Progress indicator */}
        <div className="flex space-x-1 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded ${
                index <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tour
            </Button>
            {!isFirstStep && (
              <Button variant="outline" onClick={handlePrevious}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
          </div>

          <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
            {isLastStep ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing onboarding state
export function useOnboarding() {
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pinbridge-onboarding-completed') === 'true';
    }
    return false;
  });

  const markTourCompleted = () => {
    setHasSeenTour(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinbridge-onboarding-completed', 'true');
    }
  };

  const resetTour = () => {
    setHasSeenTour(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pinbridge-onboarding-completed');
    }
  };

  return {
    hasSeenTour,
    markTourCompleted,
    resetTour,
  };
}