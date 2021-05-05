library(dplyr)
library(ggplot2)
library(viridis)



area <- Area_R


hist <- ggplot(area, aes(x = Year, y = Area, fill = LandClass, group=Year,l=30,label=sprintf("0.1f", round(Area, digits = 1)))) +
    geom_bar(stat = "identity", position = "dodge",width=13) + 
  scale_fill_manual(values=c("#645BBF", "#2E7E9E","#A37838", "#DB891F", "#FFCC00"),
                    labels=c('Agriculture','Aquaculture','Mangrove','Other Forest','Urban'))+
    scale_x_continuous(breaks = c(1980,2000,2020)) +
    labs(x = "\n Decade\n", y = "Area Size (ha) \n", fill="Land Cover Type") + 
  geom_text(aes(label=Area), vjust=-0.4, size=3, colour="black")+
  theme(panel.grid = element_blank(),
        legend.position = "bottom",
        axis.text = element_text(size = 10), 
        axis.title = element_text(size = 14),
        legend.text = element_text(size=10),
        legend.title= element_text(size=12, face="bold"),
        plot.title = element_text(size = 10, hjust = 0.5, face = "bold"))+
    facet_wrap(~LandClass, scale="free")+ 
  theme(strip.text.x = element_text(size = 12, colour = "black", face="bold"))
plot(hist)



