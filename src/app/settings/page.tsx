'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAllData, getPlaceCount } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, AlertTriangle, Shield, Crown, Eye } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';
import { paymentService } from '@/lib/services/payment-service';
import { authService } from '@/lib/services/auth-service';
import { useApiAvailability } from '@/lib/hooks/use-api-availability';

export default function SettingsPage() {
  const router = useRouter();
  const [placeCount, setPlaceCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adPreferences, setAdPreferences] = useState({ adsEnabled: true });
  const [isPremium, setIsPremium] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { status: apiStatus, isLoading: apiStatusLoading } = useApiAvailability();

  useEffect(() => {
    getPlaceCount().then(setPlaceCount);
    
    // Load ad preferences
    const stored = localStorage.getItem('pinbridge_ad_preferences');
    if (stored) {
      setAdPreferences(JSON.parse(stored));
    }

    // Check premium status
    setIsPremium(paymentService.isPremiumUser());
    setIsLoggedIn(authService.isLoggedIn());

    // Listen for subscription updates
    const handleSubscriptionUpdate = () => {
      setIsPremium(paymentService.isPremiumUser());
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  const handleDeleteAll = async () => {
    await clearAllData();
    setShowDeleteConfirm(false);
    router.push('/');
  };

  const handleAdPreferenceChange = (enabled: boolean) => {
    const newPreferences = { adsEnabled: enabled };
    setAdPreferences(newPreferences);
    adService.updateUserPreferences(newPreferences);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your data and preferences</p>
      </div>

      {/* Premium Status */}
      {isPremium ? (
        <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-900">Premium Account</span>
              <Badge className="bg-yellow-600">Active</Badge>
            </CardTitle>
            <CardDescription className="text-yellow-800">
              You're enjoying an ad-free experience with unlimited transfers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/premium')}>
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-blue-600" />
              <span className="text-blue-900">Upgrade to Premium</span>
            </CardTitle>
            <CardDescription className="text-blue-800">
              Remove ads, get unlimited transfers, and priority support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/premium')}>
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ad Preferences */}
      {!isPremium && !isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Advertisement Preferences</span>
            </CardTitle>
            <CardDescription>
              Control how ads are displayed in PinBridge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="ads-enabled">Show Advertisements</Label>
                <p className="text-sm text-muted-foreground">
                  Ads help keep PinBridge free. Disable to hide ads (some features may be limited).
                </p>
              </div>
              <Switch
                id="ads-enabled"
                checked={adPreferences.adsEnabled}
                onCheckedChange={handleAdPreferenceChange}
              />
            </div>

            {!adPreferences.adsEnabled && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-900">Limited Experience</p>
                    <p className="text-orange-800">
                      With ads disabled, some features may be limited. Consider upgrading to Premium for the best experience.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <h4 className="font-medium mb-2">Why We Show Ads</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Ads help us keep PinBridge completely free</li>
                <li>• We only show relevant, travel-related advertisements</li>
                <li>• Your privacy is protected - we don't sell personal data</li>
                <li>• Premium users enjoy an ad-free experience</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoggedIn && !isPremium && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-green-600" />
              <span className="text-green-900">Ads Disabled for Logged-In Users</span>
            </CardTitle>
            <CardDescription className="text-green-800">
              You're logged in, so we keep the experience ad-free.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Automation Status</CardTitle>
          <CardDescription>Automated transfer availability for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {apiStatusLoading && <p>Checking API availability...</p>}
          {!apiStatusLoading && apiStatus && (
            <div className="space-y-1">
              <p>
                Apple Maps API: {apiStatus.apple.configured ? 'Configured' : 'Not configured'}
              </p>
              <p>
                Google Maps API: {apiStatus.google.configured ? 'Configured' : 'Not configured'}
              </p>
              {!apiStatus.apple.configured && !apiStatus.google.configured && (
                <p className="text-amber-700">
                  Automated transfer is temporarily unavailable. Please configure API keys.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Privacy & Data</span>
          </CardTitle>
          <CardDescription>
            Your data privacy and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Data Storage</h4>
            <p className="text-sm text-muted-foreground">
              All your data is stored locally in your browser by default. {placeCount} places stored.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Analytics</h4>
            <p className="text-sm text-muted-foreground">
              We collect anonymous usage data to improve PinBridge. No personal information is shared.
            </p>
          </div>

          <Button variant="outline" onClick={() => router.push('/export')}>
            <Download className="w-4 h-4 mr-2" />
            Export Data Backup
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>These actions cannot be undone</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Local Data
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
              <p className="text-sm text-red-800">
                This will permanently delete all {placeCount} places, collections, and transfer
                packs from your browser. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDeleteAll}>
                  Yes, Delete Everything
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About PinBridge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>PinBridge helps you transfer saved places between Apple Maps and Google Maps.</p>
          <p>
            This is a guided migration tool - you&apos;ll need to manually save each place in the
            target app because neither Apple nor Google provide public APIs to add places to your
            saved lists.
          </p>
          <p className="pt-2">
            <strong>Privacy:</strong> Your data stays on your device by default. No account
            required.
          </p>
          <p className="pt-2">
            <strong>Support:</strong> PinBridge is supported by ads and premium subscriptions.
            Thank you for helping us keep this service free!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
