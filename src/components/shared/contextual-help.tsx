'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  HelpCircle, 
  Info, 
  Lightbulb, 
  AlertCircle,
  CheckCircle,
  ExternalLink,
  X
} from 'lucide-react';

interface HelpContent {
  title: string;
  description: string;
  tips?: string[];
  links?: Array<{ label: string; url: string }>;
  type?: 'info' | 'tip' | 'warning' | 'success';
}

interface ContextualHelpProps {
  content: HelpContent;
  trigger?: 'hover' | 'click';
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const HELP_CONTENT: Record<string, HelpContent> = {
  'confidence-score': {
    title: 'Confidence Score',
    description: 'Our AI analyzes name similarity, address matching, geographic distance, and place category to determine how likely this match is correct.',
    tips: [
      'High confidence (90%+): Usually safe to accept automatically',
      'Medium confidence (70-89%): Worth a quick review',
      'Low confidence (<70%): Requires manual verification'
    ],
    type: 'info'
  },
  'bulk-actions': {
    title: 'Bulk Actions',
    description: 'Speed up verification by applying actions to multiple matches at once.',
    tips: [
      'Select matches using checkboxes',
      'Use "Accept All High Confidence" for quick processing',
      'Filter by confidence level to focus on uncertain matches'
    ],
    type: 'tip'
  },
  'manual-search': {
    title: 'Manual Search',
    description: 'When automatic matching fails, you can search the target service directly to find the correct place.',
    tips: [
      'Try different search terms if the first search fails',
      'Use address or landmark names for better results',
      'Mark places as "Not Found" if they don\'t exist in the target service'
    ],
    type: 'info'
  },
  'processing-time': {
    title: 'Processing Time',
    description: 'Automatic processing time depends on the number of places and API response times.',
    tips: [
      'Small collections (10-50 places): 1-2 minutes',
      'Medium collections (50-100 places): 2-5 minutes',
      'Large collections (100+ places): 5-10 minutes',
      'You can pause and resume processing at any time'
    ],
    type: 'info'
  },
  'api-limits': {
    title: 'API Rate Limits',
    description: 'We respect mapping service rate limits to ensure reliable operation.',
    tips: [
      'Processing may slow down if rate limits are reached',
      'Cached results help reduce API calls for repeated searches',
      'Consider processing large collections in smaller batches'
    ],
    type: 'warning'
  },
  'data-privacy': {
    title: 'Data Privacy',
    description: 'We only send necessary place information to mapping services for matching.',
    tips: [
      'Only place names, addresses, and coordinates are sent',
      'No personal information or notes are shared',
      'Results are cached locally to minimize API calls',
      'You can clear cached data anytime in settings'
    ],
    type: 'success'
  },
  'transfer-execution': {
    title: 'Transfer Execution',
    description: 'After verification, places are opened in your target mapping app in controlled batches.',
    tips: [
      'Places open in batches of 5 to avoid overwhelming your browser',
      '2-second delay between batches for better performance',
      'Each place opens in a new tab/window',
      'You can preview URLs before opening them'
    ],
    type: 'info'
  },
  'session-recovery': {
    title: 'Session Recovery',
    description: 'Your progress is automatically saved and can be resumed if interrupted.',
    tips: [
      'Processing state is saved every few operations',
      'You can safely close the browser and resume later',
      'Verified matches are preserved across sessions',
      'Use the "Resume Processing" button to continue'
    ],
    type: 'success'
  },
  'match-factors': {
    title: 'Match Factors',
    description: 'Understanding how we determine match quality helps you make better verification decisions.',
    tips: [
      'Name Similarity: Fuzzy matching handles variations and typos',
      'Address Matching: Compares street addresses and postal codes',
      'Geographic Distance: Closer locations score higher',
      'Category Matching: Restaurant to restaurant, shop to shop, etc.'
    ],
    type: 'info'
  },
  'error-handling': {
    title: 'Error Handling',
    description: 'When things go wrong, we provide clear information and recovery options.',
    tips: [
      'Network errors: Automatic retry with exponential backoff',
      'API errors: Graceful fallback to manual search',
      'Invalid data: Clear error messages with suggested fixes',
      'Rate limiting: Automatic queuing and retry'
    ],
    type: 'warning'
  }
};

export function ContextualHelp({ 
  content, 
  trigger = 'click',
  position = 'top',
  size = 'md',
  className = ''
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = () => {
    switch (content.type) {
      case 'tip': return <Lightbulb className="h-4 w-4 text-yellow-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getContentWidth = () => {
    switch (size) {
      case 'sm': return 'w-64';
      case 'lg': return 'w-96';
      default: return 'w-80';
    }
  };

  const getBorderColor = () => {
    switch (content.type) {
      case 'tip': return 'border-yellow-200';
      case 'warning': return 'border-orange-200';
      case 'success': return 'border-green-200';
      default: return 'border-blue-200';
    }
  };

  const getBackgroundColor = () => {
    switch (content.type) {
      case 'tip': return 'bg-yellow-50';
      case 'warning': return 'bg-orange-50';
      case 'success': return 'bg-green-50';
      default: return 'bg-blue-50';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 hover:bg-gray-100 ${className}`}
          onMouseEnter={trigger === 'hover' ? () => setIsOpen(true) : undefined}
          onMouseLeave={trigger === 'hover' ? () => setIsOpen(false) : undefined}
        >
          <HelpCircle className="h-4 w-4 text-gray-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={`${getContentWidth()} p-0`}
        side={position}
        align="start"
      >
        <Card className={`border-0 shadow-lg ${getBorderColor()}`}>
          <CardContent className={`p-4 ${getBackgroundColor()}`}>
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getIcon()}
                  <h3 className="font-semibold text-sm text-gray-900">
                    {content.title}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-gray-200"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 leading-relaxed">
                {content.description}
              </p>

              {/* Tips */}
              {content.tips && content.tips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-800 uppercase tracking-wide">
                    Tips
                  </h4>
                  <ul className="space-y-1">
                    {content.tips.map((tip, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start space-x-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Links */}
              {content.links && content.links.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-800 uppercase tracking-wide">
                    Learn More
                  </h4>
                  <div className="space-y-1">
                    {content.links.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

// Predefined help components for common use cases
export function ConfidenceScoreHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['confidence-score']} {...props} />;
}

export function BulkActionsHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['bulk-actions']} {...props} />;
}

export function ManualSearchHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['manual-search']} {...props} />;
}

export function ProcessingTimeHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['processing-time']} {...props} />;
}

export function ApiLimitsHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['api-limits']} {...props} />;
}

export function DataPrivacyHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['data-privacy']} {...props} />;
}

export function TransferExecutionHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['transfer-execution']} {...props} />;
}

export function SessionRecoveryHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['session-recovery']} {...props} />;
}

export function MatchFactorsHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['match-factors']} {...props} />;
}

export function ErrorHandlingHelp(props: Omit<ContextualHelpProps, 'content'>) {
  return <ContextualHelp content={HELP_CONTENT['error-handling']} {...props} />;
}