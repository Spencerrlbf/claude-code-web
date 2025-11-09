import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function Preview() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-white">
          shadcn/ui Component Test
        </h1>

        {/* Button Tests */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Default Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>

        {/* Card Tests */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Matching</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  Find candidates you'd never discover on LinkedIn
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deep-Tech Expertise</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  Specialized in ML, AI, robotics, and frontier tech
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality Over Quantity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  We send you 5 perfect candidates, not 50 resumes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Form Inputs</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-white mb-2 block">
                  Email
                </label>
                <Input type="email" placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-white mb-2 block">
                  Message
                </label>
                <Textarea placeholder="Tell us about your hiring needs..." />
              </div>
              <Button className="w-full">Submit</Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-slate-400 pt-8">
          <p>✅ All shadcn/ui components installed successfully!</p>
          <p className="text-sm mt-2">
            Visit <code className="bg-slate-800 px-2 py-1 rounded">localhost:3000</code> to see your AI Researcher Tool
          </p>
        </div>
      </div>
    </div>
  )
}
