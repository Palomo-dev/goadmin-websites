interface HowItWorksStepsProps {
  content: {
    title?: string
    subtitle?: string
    steps?: Array<{
      title: string
      description?: string
      icon?: string
    }>
  }
  primaryColor?: string
}

export function HowItWorksSteps({ content, primaryColor }: HowItWorksStepsProps) {
  const steps = content.steps || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-12">{content.subtitle}</p>
      )}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, i) => (
            <div key={i} className="text-center relative">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4"
                style={{ backgroundColor: primaryColor }}
              >
                {step.icon || i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gray-200" />
              )}
              <h3 className="font-bold text-lg mb-2">{step.title}</h3>
              {step.description && (
                <p className="text-gray-500 text-sm">{step.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
