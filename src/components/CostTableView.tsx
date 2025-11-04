import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { TrendingDown, TrendingUp } from "lucide-react";

interface CostTableViewProps {
  data: {
    month: string;
    cost: number;
    savings: number;
    net: number;
  }[];
}

export const CostTableView = ({ data }: CostTableViewProps) => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();

  const totals = data.reduce(
    (acc, item) => ({
      cost: acc.cost + item.cost,
      savings: acc.savings + item.savings,
      net: acc.net + item.net,
    }),
    { cost: 0, savings: 0, net: 0 }
  );

  const avgSavingsPercentage = totals.cost > 0 ? ((totals.savings / totals.cost) * 100) : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border/50">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-foreground font-semibold">{t('costs.month')}</TableHead>
              <TableHead className="text-right text-foreground font-semibold">{t('costs.providerCost')}</TableHead>
              <TableHead className="text-right text-success font-semibold">{t('costs.aiSavings')}</TableHead>
              <TableHead className="text-right text-foreground font-semibold">{t('costs.netCost')}</TableHead>
              <TableHead className="text-right text-foreground font-semibold">{t('costs.savingsPercent')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => {
              const savingsPercentage = item.cost > 0 ? ((item.savings / item.cost) * 100) : 0;
              const costFormatted = formatCurrency(item.cost, { sourceCurrency: 'USD' });
              const savingsFormatted = formatCurrency(item.savings, { sourceCurrency: 'USD' });
              const netFormatted = formatCurrency(item.net, { sourceCurrency: 'USD' });
              
              return (
                <TableRow 
                  key={index} 
                  className="border-border/30 hover:bg-primary/5 transition-colors"
                >
                  <TableCell className="font-medium text-foreground">{item.month}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {costFormatted.value}
                  </TableCell>
                  <TableCell className="text-right text-success font-medium">
                    -{savingsFormatted.value}
                  </TableCell>
                  <TableCell className="text-right text-foreground font-semibold">
                    {netFormatted.value}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="w-4 h-4 text-success" />
                      <span className="text-success font-medium">
                        {savingsPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Totals Row */}
            <TableRow className="border-t-2 border-border bg-muted/30 font-bold">
              <TableCell className="text-foreground">{t('costs.total')}</TableCell>
              <TableCell className="text-right text-foreground">
                {formatCurrency(totals.cost, { sourceCurrency: 'USD' }).value}
              </TableCell>
              <TableCell className="text-right text-success">
                -{formatCurrency(totals.savings, { sourceCurrency: 'USD' }).value}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {formatCurrency(totals.net, { sourceCurrency: 'USD' }).value}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-4 h-4 text-success" />
                  <span className="text-success">
                    {avgSavingsPercentage.toFixed(1)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};