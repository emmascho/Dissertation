library(ggplot2)
library(viridisLite)
library(viridis)
library(hrbrthemes)


causes <- RCauses

bubbleplot <- ggplot(causes, aes(, x=Factor, y=Area,size=Area, color=ChangeType)) +
  geom_point(alpha=0.5, fill="pink") +
  scale_size(range = c(4, 20), name="Area Loss (ha)")+
  labs(x="\nCauses\n",
       y= "Mangrove Area Loss (ha)\n", color="Type of Change")+
  theme_bw() 

plot(bubbleplot)

