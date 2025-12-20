import React from 'react';

const iconNames = [
  'Package', 'Search', 'Loader2', 'AlertTriangle', 'CheckCircle', 'ExternalLink', 'ShoppingCart', 'DollarSign', 'Star', 'TrendingUp',
  'ChevronDown', 'ChevronUp', 'Check'
];

const mockIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {};
iconNames.forEach((name) => {
  const Comp: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg aria-label={name} {...props} />
  );
  mockIcons[name] = Comp;
});

module.exports = mockIcons;
