
library(ggplot2)
library(plotly)
library(viridis)

change <- na.omit(RPAsMangrove)

scatter <- ggplot(change, aes (x = Park, y = Area, colour = Change)) +
  geom_point() +                                               # Changing point size          
  theme_bw() 

bubbleplot <- ggplot(change,aes(x=Park, y=Area, size = Area, color = Change)) +
  geom_point(alpha=0.7) +
  labs( x = "National Park", y = "Area Change (ha) \n") + 
  scale_color_viridis(discrete=TRUE, guide=FALSE) +
  theme(axis.text = element_text(size = 8), 
        axis.text.x = element_text(angle = 45, hjust = 1),
        legend.title = element_text(face = "bold"),
        legend.position = "right", 
        legend.box.background = element_rect(color = "grey", size = 0.3))



plot(bubbleplot)

# Other visualisation using stacked barchart 

barchart <- ggplot(change, aes(fill=Change, y=Area, x=Park)) + 
  geom_bar(position="stack", stat="identity")+
  labs( x = "National Park", y = "Area Change (ha) \n")+
  scale_fill_manual(values=c("#EDCB07", "#E69600","#18A156"))+
  theme(axis.text = element_text(size = 8),
        axis.text.x = element_text(angle = 45, hjust = 1),
        legend.title = element_text(face = "bold"),
        legend.position = "right", 
        panel.grid.major = element_line(colour="grey",size = rel(0.5)), 
        panel.grid.minor = element_blank(), 
        panel.background = element_rect(fill = "#F5F5F5"), 
        legend.box.background = element_rect(color = "grey", size = 0.3))



plot(barchart)




